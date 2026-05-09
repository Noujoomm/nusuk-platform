/**
 * Smart Arabic text enhancer for Roya report fields.
 *
 * Two Anthropic calls per enhance:
 *   1. Diagnostic — returns a JSON quality score (4 axes 1-5) plus the
 *      intervention level we should use.
 *   2. Enhancement — light / medium / heavy prompt picked from the
 *      diagnostic, with the track's rubric injected so the model
 *      respects domain glossary and tone.
 *
 * Why a diagnostic step at all: it's the only honest way to enforce
 * "floor-lifting, not ceiling-touching". A track that already writes
 * great reports gets the light prompt and barely moves; a track that
 * struggles gets a real rewrite. Without the diagnostic, we'd either
 * over-edit good text or under-edit bad text — both unfair on the
 * track leaderboard.
 *
 * Auth + rate limiting are owned by the controller. This service
 * trusts that whatever calls it has already gated.
 */

import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../common/prisma.service';
import {
  EnhanceResponse,
  InterventionLevel,
  QualityScores,
} from './dto/enhance-response.dto';
import { buildDiagnosticPrompt } from './prompts/diagnostic.prompt';
import { buildHeavyTouchPrompt } from './prompts/heavy-touch.prompt';
import { buildLightTouchPrompt } from './prompts/light-touch.prompt';
import { buildMediumTouchPrompt } from './prompts/medium-touch.prompt';
import { resolveRubric } from './rubrics';
import type { TrackRubric } from './rubrics/rubric.interface';

const DEFAULT_MODEL = 'claude-sonnet-4-5';
const DIAGNOSTIC_MAX_TOKENS = 600;
const ENHANCE_MAX_TOKENS = 4_000;
const REQUEST_TIMEOUT_MS = 50_000;
const MIN_WORDS = 10;
const MAX_CHARS = 10_000;

/** Threshold cutoffs for picking the enhancement prompt from the
 *  diagnostic average. Centralised here so changing the dispatch
 *  rule is a one-line numerical edit. */
const LIGHT_THRESHOLD = 4.0;
const HEAVY_THRESHOLD = 2.5;

@Injectable()
export class TextEnhancerService {
  private readonly logger = new Logger(TextEnhancerService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'ANTHROPIC_API_KEY not set — /api/text-enhancer/enhance will return 503',
      );
      this.client = null;
    } else {
      this.client = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS });
    }
    this.model =
      this.config.get<string>('TEXT_ENHANCER_MODEL') ??
      this.config.get<string>('ANTHROPIC_MODEL_DEFAULT') ??
      DEFAULT_MODEL;
  }

  // ─── Public API ────────────────────────────────────────────────────

  async enhance(params: {
    text: string;
    trackId: string;
    fieldContext?: string;
    userId: string;
  }): Promise<EnhanceResponse> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'تعذّر الاتصال بخدمة التحسين، حاول مجدداً.',
      );
    }
    this.assertInputSize(params.text);

    const track = await this.prisma.track.findUnique({
      where: { id: params.trackId },
      select: { id: true, nameAr: true },
    });
    if (!track) {
      throw new BadRequestException('المسار المحدد غير موجود.');
    }
    const rubric = resolveRubric(track.nameAr);

    const diagnostic = await this.diagnose(params.text, rubric);
    const enhancedText = await this.applyEnhancement(
      params.text,
      rubric,
      diagnostic.interventionLevel,
    );

    const changesCount = countWordChanges(params.text, enhancedText);
    const diagnosticSummary = summariseWeaknesses(
      diagnostic.weaknesses,
      diagnostic.interventionLevel,
    );

    const auditId = randomUUID();
    await this.prisma.textEnhancementLog.create({
      data: {
        id: auditId,
        userId: params.userId,
        trackId: params.trackId,
        fieldContext: params.fieldContext ?? null,
        originalText: params.text,
        enhancedText,
        interventionLevel: diagnostic.interventionLevel,
        qualityScores: diagnostic.qualityScore as unknown as object,
        changesCount,
        diagnosticSummary,
      },
    });

    return {
      enhancedText,
      interventionLevel: diagnostic.interventionLevel,
      qualityScores: diagnostic.qualityScore,
      changesCount,
      diagnosticSummary,
      auditId,
    };
  }

  async accept(auditId: string, userId: string): Promise<{ ok: true }> {
    const log = await this.prisma.textEnhancementLog.findUnique({
      where: { id: auditId },
      select: { id: true, userId: true, accepted: true },
    });
    if (!log) throw new NotFoundException('سجل التحسين غير موجود.');
    if (log.userId !== userId) {
      // Don't leak existence — same shape as not-found.
      throw new NotFoundException('سجل التحسين غير موجود.');
    }
    if (log.accepted) return { ok: true };
    await this.prisma.textEnhancementLog.update({
      where: { id: auditId },
      data: { accepted: true, acceptedAt: new Date() },
    });
    return { ok: true };
  }

  // ─── Steps ─────────────────────────────────────────────────────────

  /**
   * Visible-for-tests: pure mapping from diagnostic averages to
   * intervention level. Kept independent of the model call so it can
   * be unit-tested without mocking Anthropic.
   */
  static decideInterventionLevel(scores: QualityScores): InterventionLevel {
    const avg =
      (scores.language +
        scores.organization +
        scores.clarity +
        scores.professionalism) /
      4;
    if (avg >= LIGHT_THRESHOLD) return 'light';
    if (avg < HEAVY_THRESHOLD) return 'heavy';
    return 'medium';
  }

  private async diagnose(
    text: string,
    rubric: TrackRubric,
  ): Promise<{
    qualityScore: QualityScores;
    weaknesses: string[];
    interventionLevel: InterventionLevel;
  }> {
    const raw = await this.runClaude(buildDiagnosticPrompt(text, rubric), {
      maxTokens: DIAGNOSTIC_MAX_TOKENS,
    });
    const parsed = parseDiagnosticJson(raw);
    // Recompute the level locally rather than trusting the model — the
    // model can be inconsistent on edge averages, and the rule is
    // simple enough to enforce deterministically.
    const interventionLevel = TextEnhancerService.decideInterventionLevel(
      parsed.qualityScore,
    );
    return { ...parsed, interventionLevel };
  }

  private async applyEnhancement(
    text: string,
    rubric: TrackRubric,
    level: InterventionLevel,
  ): Promise<string> {
    const prompt =
      level === 'light'
        ? buildLightTouchPrompt(text, rubric)
        : level === 'medium'
          ? buildMediumTouchPrompt(text, rubric)
          : buildHeavyTouchPrompt(text, rubric);
    const raw = await this.runClaude(prompt, {
      maxTokens: ENHANCE_MAX_TOKENS,
    });
    return stripFences(raw).trim();
  }

  private async runClaude(
    prompt: string,
    opts: { maxTokens: number },
  ): Promise<string> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'تعذّر الاتصال بخدمة التحسين، حاول مجدداً.',
      );
    }
    try {
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: opts.maxTokens,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      if (!text) {
        throw new ServiceUnavailableException(
          'تعذّر الاتصال بخدمة التحسين، حاول مجدداً.',
        );
      }
      return text;
    } catch (err: any) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.logger.error(`Claude call failed: ${err?.message ?? err}`);
      throw new ServiceUnavailableException(
        'تعذّر الاتصال بخدمة التحسين، حاول مجدداً.',
      );
    }
  }

  private assertInputSize(text: string): void {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      throw new BadRequestException('النص فارغ.');
    }
    if (countArabicWords(trimmed) < MIN_WORDS) {
      throw new BadRequestException(
        `النص قصير جداً للتحسين (الحد الأدنى ${MIN_WORDS} كلمات).`,
      );
    }
    if (trimmed.length > MAX_CHARS) {
      throw new BadRequestException(
        `النص يتجاوز الحد المسموح (${MAX_CHARS} حرف).`,
      );
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function stripFences(s: string): string {
  return s
    .trim()
    .replace(/^```(?:json|text|markdown)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

function parseDiagnosticJson(raw: string): {
  qualityScore: QualityScores;
  weaknesses: string[];
} {
  const cleaned = stripFences(raw);
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new ServiceUnavailableException(
      'تعذّر الاتصال بخدمة التحسين، حاول مجدداً.',
    );
  }
  const q = parsed?.qualityScore ?? {};
  const score: QualityScores = {
    language: clampScore(q.language),
    organization: clampScore(q.organization),
    clarity: clampScore(q.clarity),
    professionalism: clampScore(q.professionalism),
  };
  const weaknesses = Array.isArray(parsed?.weaknesses)
    ? parsed.weaknesses
        .filter((w: unknown): w is string => typeof w === 'string')
        .slice(0, 5)
    : [];
  return { qualityScore: score, weaknesses };
}

function clampScore(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 3;
  return Math.max(1, Math.min(5, Math.round(v)));
}

/**
 * Multiset-based word-difference count. Not a true diff, but useful as
 * a UI hint: shows the user roughly how much was moved/edited so they
 * can decide whether to skim or read carefully. Returns a non-negative
 * integer.
 */
function countWordChanges(before: string, after: string): number {
  const tokenize = (s: string): string[] =>
    s
      .replace(/[«»"'،,.؛;:؟?!()\[\]{}]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  const a = new Map<string, number>();
  const b = new Map<string, number>();
  for (const w of tokenize(before)) a.set(w, (a.get(w) ?? 0) + 1);
  for (const w of tokenize(after)) b.set(w, (b.get(w) ?? 0) + 1);
  const keys = new Set([...a.keys(), ...b.keys()]);
  let diff = 0;
  for (const k of keys) {
    diff += Math.abs((a.get(k) ?? 0) - (b.get(k) ?? 0));
  }
  // Symmetric set-difference counts each substitution twice (once on
  // each side), so halve to get an "edits" approximation.
  return Math.ceil(diff / 2);
}

/**
 * Arabic-aware word count, kept in sync with the frontend's helper in
 * `text-enhancer-button.tsx`. Otherwise the frontend can show "12
 * كلمة ✓" while the backend rejects the same payload at 9.
 *   - Tatweel (U+0640) is removed (visual lengthening, not a separator).
 *   - NBSP / zero-width joiners / direction marks / BOM become spaces.
 */
function countArabicWords(s: string): number {
  return s
    .replace(/ـ/g, '')
    .replace(/[ ‌‍‎‏﻿]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

function summariseWeaknesses(
  weaknesses: string[],
  level: InterventionLevel,
): string {
  if (weaknesses.length === 0) {
    return level === 'light'
      ? 'تنقيح طفيف للإملاء وعلامات الترقيم.'
      : level === 'medium'
        ? 'إعادة صياغة بعض الجمل وتوحيد النبرة.'
        : 'إعادة هيكلة وصياغة شاملة لأسلوب احترافي.';
  }
  return weaknesses.slice(0, 3).join(' • ');
}
