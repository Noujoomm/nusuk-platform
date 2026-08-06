import sharp from 'sharp';
import { FilePayload } from './file-to-base64';

export type ClaudeMediaType = FilePayload['mediaType'];

export interface PreparedImage {
  buffer: Buffer;
  mediaType: ClaudeMediaType;
}

/**
 * Anthropic rejects any image whose BASE64 payload exceeds 10 MB
 * (10,485,760 bytes). base64 inflates raw bytes by ~4/3, so we target a raw
 * ceiling of 7 MB (~9.3 MB once encoded) to stay comfortably under the cap.
 */
export const MAX_RAW_BYTES = 7 * 1024 * 1024;
/** Anthropic's hard limit on the base64 string length, for reference/tests. */
export const CLAUDE_IMAGE_BASE64_LIMIT = 10 * 1024 * 1024;

/**
 * Images at or below this are sent untouched — most invoices are small and
 * re-encoding would only cost CPU and (for JPEG) a little quality.
 */
const PASSTHROUGH_BYTES = Math.floor(4.5 * 1024 * 1024);

/**
 * Progressive downscale/quality ladder. Claude internally downsamples images
 * beyond ~1568 px on the long edge, so 2000 px already loses no accuracy; the
 * lower rungs only engage for pathologically large/noisy phone photos. The
 * last rung is the hard floor — if the output still doesn't fit, we throw.
 */
const COMPRESSION_STEPS: ReadonlyArray<{ maxEdge: number; quality: number }> = [
  { maxEdge: 2000, quality: 80 },
  { maxEdge: 1800, quality: 72 },
  { maxEdge: 1600, quality: 64 },
  { maxEdge: 1400, quality: 52 },
  { maxEdge: 1200, quality: 40 }, // hard floor
];

function fmtMB(bytes: number): string {
  return `${(bytes / 1048576).toFixed(2)}MB`;
}

/**
 * Ensure an image buffer is safe to send to the Claude vision API, resizing and
 * re-encoding to JPEG when it would otherwise blow the 10 MB base64 limit.
 *
 * - PDFs / non-image media types pass through untouched.
 * - Images under ~4.5 MB pass through untouched.
 * - Larger images are downscaled (long edge ≤ 2000 px) and re-encoded as JPEG,
 *   stepping quality/dimensions down until the raw size fits under ~7 MB. When
 *   re-encoded, the returned `mediaType` becomes `image/jpeg`.
 * - Corrupt/undecodable buffers are handled gracefully: sent as-is if already
 *   under the limit, otherwise a clear descriptive error is thrown.
 *
 * @param log optional sink for compression diagnostics (original → final size,
 *            dimensions, quality). Wire this to a NestJS `Logger.log`.
 */
export async function prepareImageForClaude(
  buffer: Buffer,
  mediaType: ClaudeMediaType,
  log?: (message: string) => void,
): Promise<PreparedImage> {
  // PDFs (and anything that isn't a raster image) are never processed here.
  if (mediaType === 'application/pdf' || !mediaType.startsWith('image/')) {
    return { buffer, mediaType };
  }

  // Already small enough — send as-is.
  if (buffer.length <= PASSTHROUGH_BYTES) {
    return { buffer, mediaType };
  }

  // Probe the image. A corrupt/undecodable buffer can't be compressed; if it
  // happens to sit under the raw limit we still try sending it, otherwise fail
  // loudly rather than firing a doomed request at the API.
  let origWidth: number | undefined;
  let origHeight: number | undefined;
  try {
    const meta = await sharp(buffer).metadata();
    origWidth = meta.width;
    origHeight = meta.height;
  } catch {
    if (buffer.length <= MAX_RAW_BYTES) {
      log?.(
        `[prepareImageForClaude] unreadable image metadata (${fmtMB(buffer.length)}); sending original`,
      );
      return { buffer, mediaType };
    }
    throw new Error(
      `تعذّرت معالجة الصورة لتصغيرها (${fmtMB(buffer.length)}) وحجمها يتجاوز الحد المسموح لإرسالها للتحليل.`,
    );
  }

  let last: { buffer: Buffer; maxEdge: number; quality: number } | null = null;
  for (const step of COMPRESSION_STEPS) {
    let out: Buffer;
    try {
      out = await sharp(buffer)
        .rotate() // bake in EXIF orientation before metadata is stripped
        .resize({
          width: step.maxEdge,
          height: step.maxEdge,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: step.quality, mozjpeg: true })
        .toBuffer();
    } catch (err) {
      throw new Error(
        `فشل تصغير الصورة عبر sharp: ${(err as Error)?.message ?? 'خطأ غير معروف'}`,
      );
    }

    last = { buffer: out, maxEdge: step.maxEdge, quality: step.quality };
    if (out.length <= MAX_RAW_BYTES) {
      const finalMeta = await sharp(out).metadata().catch(() => null);
      log?.(
        `[prepareImageForClaude] compressed ${fmtMB(buffer.length)} → ${fmtMB(out.length)} ` +
          `| ${origWidth ?? '?'}x${origHeight ?? '?'} → ${finalMeta?.width ?? '?'}x${finalMeta?.height ?? '?'} ` +
          `| jpeg q${step.quality} maxEdge=${step.maxEdge}`,
      );
      return { buffer: out, mediaType: 'image/jpeg' };
    }
  }

  // Exhausted the ladder and it's still too large.
  throw new Error(
    `الصورة أكبر من أن تُرسل للتحليل حتى بعد الضغط ` +
      `(${fmtMB(last?.buffer.length ?? buffer.length)} عند الجودة ${last?.quality}/${last?.maxEdge}px، ` +
      `الحد ${fmtMB(MAX_RAW_BYTES)}).`,
  );
}
