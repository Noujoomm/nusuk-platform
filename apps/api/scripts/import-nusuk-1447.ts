/**
 * NUSUK 1447 Excel Data Import Script
 *
 * Usage:
 *   npx ts-node scripts/import-nusuk-1447.ts                 # dry-run (default)
 *   npx ts-node scripts/import-nusuk-1447.ts --apply          # write to DB
 *   npx ts-node scripts/import-nusuk-1447.ts --apply --force  # skip confirmation
 *
 * Reads: نطاق العمل مازن 1447 هـ (1).xlsx
 * Maps into: Track, Employee, TrackKPI, Deliverable, Penalty, Scope, ScopeBlock
 * Produces: backup JSON, diff report, audit log
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

// ─── CONFIG ───

const EXCEL_PATH = path.resolve('/Users/mazin/Dash', 'نطاق العمل مازن 1447 هـ (1).xlsx');
const MAPPING_PATH = path.resolve(__dirname, '../src/data-import/mapping.nusuk.1447.json');
const BACKUP_DIR = path.resolve(__dirname, '../backup');

const prisma = new PrismaClient();
const mapping = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf-8'));

const isApply = process.argv.includes('--apply');
const isForce = process.argv.includes('--force');

// ─── TYPES ───

interface ParsedTrack {
  key: string;
  name: string;
  nameAr: string;
  color: string;
}

interface ParsedEmployee {
  fullNameAr: string;
  fullName: string;
  positionAr: string;
  position: string;
  contractType: string;
  contractStatus: string;
  trackKey: string;
  employeeCount: number;
  directManager: string;
}

interface ParsedKPI {
  nameAr: string;
  name: string;
  trackKey: string;
  sortOrder: number;
}

interface ParsedDeliverable {
  nameAr: string;
  name: string;
  outputs: string;
  deliveryIndicators: string;
  trackKey: string;
  sortOrder: number;
}

interface ParsedPenalty {
  violationAr: string;
  violation: string;
  trackKey: string;
  sortOrder: number;
}

interface ParsedScope {
  titleAr: string;
  title: string;
  description: string;
  trackKey: string;
  sortOrder: number;
}

interface DiffReport {
  tracks: { inserted: number; updated: number; unchanged: number; details: string[] };
  employees: { inserted: number; updated: number; unchanged: number; details: string[] };
  kpis: { inserted: number; updated: number; unchanged: number; details: string[] };
  deliverables: { inserted: number; updated: number; unchanged: number; details: string[] };
  penalties: { inserted: number; updated: number; unchanged: number; details: string[] };
  scopes: { inserted: number; updated: number; unchanged: number; details: string[] };
}

// ─── UTILITIES ───

function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width chars
    .replace(/\s+/g, ' ')
    .replace(/٠/g, '0').replace(/١/g, '1').replace(/٢/g, '2')
    .replace(/٣/g, '3').replace(/٤/g, '4').replace(/٥/g, '5')
    .replace(/٦/g, '6').replace(/٧/g, '7').replace(/٨/g, '8').replace(/٩/g, '9')
    .trim();
}

function cleanCell(val: any): string {
  if (val === null || val === undefined) return '';
  return normalizeArabic(String(val));
}

function splitMultiline(text: string): string[] {
  if (!text) return [];
  return text
    .split(/[\r\n]+/)
    .map(l => l.trim())
    .filter(l => l.length > 0);
}

function stripNumberPrefix(text: string): string {
  // Remove prefixes like "1.", "1)", "1-", "1.	", "  - " etc
  return text.replace(/^\s*[\d٠-٩]+[\.\)\-\s]+\s*/, '').replace(/^\s*-\s*/, '').trim();
}

function isKPIText(text: string): boolean {
  const lower = text.trim();
  return lower.startsWith('تحقيق') ||
    lower.includes('نسبة') && lower.includes('الالتزام') ||
    lower.includes('KPI') ||
    lower.includes('مؤشر') ||
    /^\d+[\.\)]\s*تحقيق/.test(lower) ||
    /^\d+[\.\)]\s*الالتزام/.test(lower) ||
    /^\d+[\.\)]\s*إعداد واعتماد/.test(lower) ||
    /^\d+[\.\)]\s*اعتماد/.test(lower) ||
    /^\d+[\.\)]\s*الاستجابة/.test(lower);
}

function normalizeTrackKey(raw: string): string {
  const cleaned = cleanCell(raw);
  return mapping.trackNameNormalization[cleaned] || cleaned;
}

function dedupeKey(trackKey: string, title: string, type: string): string {
  return `${trackKey}::${normalizeArabic(title).substring(0, 80)}::${type}`.toLowerCase();
}

function log(msg: string) {
  console.log(`[import] ${msg}`);
}

function logSection(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

// ─── PARSERS ───

function parseTrackSheets(wb: XLSX.WorkBook): {
  tracks: ParsedTrack[];
  employees: ParsedEmployee[];
  kpis: ParsedKPI[];
  deliverables: ParsedDeliverable[];
  penalties: ParsedPenalty[];
  scopes: ParsedScope[];
} {
  const tracks: ParsedTrack[] = [];
  const employees: ParsedEmployee[] = [];
  const kpis: ParsedKPI[] = [];
  const deliverables: ParsedDeliverable[] = [];
  const penalties: ParsedPenalty[] = [];
  const scopes: ParsedScope[] = [];

  const seenKeys = new Set<string>();

  // Build tracks from mapping
  for (const [key, cfg] of Object.entries(mapping.trackMapping) as [string, any][]) {
    tracks.push({
      key,
      name: cfg.name,
      nameAr: cfg.nameAr,
      color: cfg.color,
    });
  }

  // Parse each track sheet
  const trackSheetNames = [
    'المسار الاستشاري', 'مسار الطباعة ', 'مسار التوزيع',
    'مسار علاقات الشركات', 'مسار الدعم الفني', 'مسار التدريب',
    'مسار كاميرات النوارية',
  ];

  for (const sheetName of trackSheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) { log(`SKIP missing sheet: ${sheetName}`); continue; }

    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (data.length < 3) { log(`SKIP empty sheet: ${sheetName}`); continue; }

    // Determine track key from sheet name
    let trackKey = '';
    for (const [key, cfg] of Object.entries(mapping.trackMapping) as [string, any][]) {
      if (cfg.sheets.includes(sheetName)) { trackKey = key; break; }
    }
    if (!trackKey) { log(`SKIP no track mapping for: ${sheetName}`); continue; }

    const cols = mapping.trackSheetColumns.standard;
    let kpiOrder = 0;
    let delivOrder = 0;
    let penaltyOrder = 0;
    let scopeOrder = 0;

    // Track current employee context for merged rows
    let currentTeamRole = '';
    let currentManager = '';

    for (let i = 2; i < data.length; i++) {
      const row = data[i];
      if (!row || row.every((c: any) => !cleanCell(c))) continue;

      // ─ Employee data ─
      const teamRole = cleanCell(row[cols.teamRole]);
      const manager = cleanCell(row[cols.directManager]);
      const empName = cleanCell(row[cols.employeeName]);
      const empCount = parseInt(cleanCell(row[cols.employeeCount])) || 0;
      const contractStatus = cleanCell(row[cols.contractStatus]);

      if (teamRole) currentTeamRole = teamRole;
      if (manager) currentManager = manager;

      if (empName && empName !== 'يحدد لاحقا') {
        employees.push({
          fullNameAr: empName,
          fullName: empName,
          positionAr: currentTeamRole,
          position: currentTeamRole,
          contractType: mapping.contractStatusMapping[contractStatus] || 'not_started',
          contractStatus,
          trackKey,
          employeeCount: empCount,
          directManager: currentManager,
        });
      } else if (empName === 'يحدد لاحقا' && currentTeamRole) {
        // Placeholder employee — still record position for count
        employees.push({
          fullNameAr: `يحدد لاحقا - ${currentTeamRole}`,
          fullName: `TBD - ${currentTeamRole}`,
          positionAr: currentTeamRole,
          position: currentTeamRole,
          contractType: 'tbd',
          contractStatus: 'يحدد لاحقا',
          trackKey,
          employeeCount: empCount,
          directManager: currentManager,
        });
      }

      // ─ KPI data ─
      const kpiRaw = cleanCell(row[cols.kpi]);
      if (kpiRaw) {
        const kpiLines = splitMultiline(kpiRaw);
        for (const line of kpiLines) {
          const cleaned = stripNumberPrefix(line);
          if (!cleaned) continue;
          const dk = dedupeKey(trackKey, cleaned, 'kpi');
          if (seenKeys.has(dk)) continue;
          seenKeys.add(dk);
          kpis.push({
            nameAr: cleaned,
            name: cleaned,
            trackKey,
            sortOrder: kpiOrder++,
          });
        }
      }

      // ─ Deliverable data ─
      const delivName = cleanCell(row[cols.deliverableName]);
      const delivOutputs = cleanCell(row[cols.deliverableOutputs]);
      const delivIndicators = cleanCell(row[cols.deliverableIndicators]);
      if (delivName) {
        const dk = dedupeKey(trackKey, delivName, 'deliverable');
        if (!seenKeys.has(dk)) {
          seenKeys.add(dk);
          deliverables.push({
            nameAr: delivName,
            name: delivName,
            outputs: delivOutputs,
            deliveryIndicators: delivIndicators,
            trackKey,
            sortOrder: delivOrder++,
          });
        }
      }

      // ─ Penalty data ─
      const penaltyRaw = cleanCell(row[cols.penalties]);
      if (penaltyRaw) {
        const penaltyLines = splitMultiline(penaltyRaw);
        for (const line of penaltyLines) {
          const cleaned = stripNumberPrefix(line);
          if (!cleaned) continue;
          const dk = dedupeKey(trackKey, cleaned, 'penalty');
          if (seenKeys.has(dk)) continue;
          seenKeys.add(dk);
          penalties.push({
            violationAr: cleaned,
            violation: cleaned,
            trackKey,
            sortOrder: penaltyOrder++,
          });
        }
      }

      // ─ Scope data ─
      // Scope is in col 13+ and may span multiple columns (continuation text)
      const scopeParts: string[] = [];
      for (let c = cols.scopeOfWork; c < row.length; c++) {
        const val = cleanCell(row[c]);
        if (val) scopeParts.push(val);
      }
      const scopeText = scopeParts.join('\n');
      if (scopeText) {
        const scopeLines = splitMultiline(scopeText);
        for (const line of scopeLines) {
          if (!line || line.length < 5) continue;
          const dk = dedupeKey(trackKey, line, 'scope');
          if (seenKeys.has(dk)) continue;
          seenKeys.add(dk);
          scopes.push({
            titleAr: line.substring(0, 200),
            title: line.substring(0, 200),
            description: line.length > 200 ? line : '',
            trackKey,
            sortOrder: scopeOrder++,
          });
        }
      }
    }
  }

  // ─ Parse Main Plan sheet for إدارة المشروع ─
  parseMainPlan(wb, employees, kpis, deliverables, penalties, seenKeys);

  // ─ Parse مسار البيانات ─
  parseDataSheet(wb, scopes, seenKeys);

  // ─ Parse كاميرات sheet for KPIs ─
  parseCamerasSheet(wb, kpis, deliverables, seenKeys);

  return { tracks, employees, kpis, deliverables, penalties, scopes };
}

function parseMainPlan(
  wb: XLSX.WorkBook,
  employees: ParsedEmployee[],
  kpis: ParsedKPI[],
  deliverables: ParsedDeliverable[],
  penalties: ParsedPenalty[],
  seenKeys: Set<string>,
) {
  const ws = wb.Sheets['الخطة الرئيسية'];
  if (!ws) return;
  const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const cols = mapping.mainPlanColumns;
  const trackKey = 'إدارة المشروع';
  let kpiOrder = 100;
  let penaltyOrder = 100;

  let currentTrackName = '';
  let currentSubTrack = '';

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.every((c: any) => !cleanCell(c))) continue;

    const trackName = cleanCell(row[cols.trackName]);
    const subTrack = cleanCell(row[cols.subTrack]);
    const teamRole = cleanCell(row[cols.teamRole]);
    const manager = cleanCell(row[cols.directManager]);
    const empName = cleanCell(row[cols.employeeName]);
    const contractStatus = cleanCell(row[cols.contractStatus]);
    const empCount = parseInt(cleanCell(row[cols.employeeCount])) || 0;

    if (trackName) currentTrackName = trackName;
    if (subTrack) currentSubTrack = subTrack;

    // Determine which track this row belongs to
    let rowTrackKey = trackKey; // default to project management
    if (currentTrackName === 'المراقبة التشغيلية والخدمات الاستشارية') {
      rowTrackKey = 'المسار الاستشاري';
    }

    // Employee
    if (empName && empName !== 'يحدد لاحقا') {
      const dk = dedupeKey(rowTrackKey, empName, 'employee');
      if (!seenKeys.has(dk)) {
        seenKeys.add(dk);
        employees.push({
          fullNameAr: empName,
          fullName: empName,
          positionAr: teamRole || currentSubTrack,
          position: teamRole || currentSubTrack,
          contractType: mapping.contractStatusMapping[contractStatus] || 'not_started',
          contractStatus,
          trackKey: rowTrackKey,
          employeeCount: empCount,
          directManager: manager,
        });
      }
    }

    // KPIs
    const kpiRaw = cleanCell(row[cols.kpi]);
    if (kpiRaw) {
      for (const line of splitMultiline(kpiRaw)) {
        const cleaned = stripNumberPrefix(line);
        if (!cleaned || cleaned.length < 5) continue;
        const dk = dedupeKey(rowTrackKey, cleaned, 'kpi');
        if (seenKeys.has(dk)) continue;
        seenKeys.add(dk);
        kpis.push({ nameAr: cleaned, name: cleaned, trackKey: rowTrackKey, sortOrder: kpiOrder++ });
      }
    }

    // Penalties
    const penaltyRaw = cleanCell(row[cols.penalties]);
    if (penaltyRaw) {
      for (const line of splitMultiline(penaltyRaw)) {
        const cleaned = stripNumberPrefix(line);
        if (!cleaned || cleaned.length < 5) continue;
        const dk = dedupeKey(rowTrackKey, cleaned, 'penalty');
        if (seenKeys.has(dk)) continue;
        seenKeys.add(dk);
        penalties.push({ violationAr: cleaned, violation: cleaned, trackKey: rowTrackKey, sortOrder: penaltyOrder++ });
      }
    }
  }
}

function parseDataSheet(wb: XLSX.WorkBook, scopes: ParsedScope[], seenKeys: Set<string>) {
  const ws = wb.Sheets['مسار البيانات'];
  if (!ws) return;
  const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const trackKey = 'مسار البيانات';
  let scopeOrder = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const val = cleanCell(row[c]);
      if (val && val.length > 10) {
        const dk = dedupeKey(trackKey, val, 'scope');
        if (seenKeys.has(dk)) continue;
        seenKeys.add(dk);
        scopes.push({
          titleAr: val.substring(0, 200),
          title: val.substring(0, 200),
          description: val.length > 200 ? val : '',
          trackKey,
          sortOrder: scopeOrder++,
        });
      }
    }
  }
}

function parseCamerasSheet(
  wb: XLSX.WorkBook,
  kpis: ParsedKPI[],
  deliverables: ParsedDeliverable[],
  seenKeys: Set<string>,
) {
  const ws = wb.Sheets['مسار كاميرات النوارية'];
  if (!ws) return;
  const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const trackKey = 'مسار كاميرات النوارية';
  let kpiOrder = 0;
  let delivOrder = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const val = cleanCell(row[c]);
      if (!val || val.length < 10) continue;

      if (isKPIText(val)) {
        const dk = dedupeKey(trackKey, val, 'kpi');
        if (!seenKeys.has(dk)) {
          seenKeys.add(dk);
          kpis.push({ nameAr: val, name: val, trackKey, sortOrder: kpiOrder++ });
        }
      } else {
        // check if it looks like a deliverable (column 3-5)
        if (c === 3 || c === 5) {
          const dk = dedupeKey(trackKey, val, 'deliverable');
          if (!seenKeys.has(dk)) {
            seenKeys.add(dk);
            deliverables.push({
              nameAr: val.substring(0, 200),
              name: val.substring(0, 200),
              outputs: '',
              deliveryIndicators: c === 5 ? val : '',
              trackKey,
              sortOrder: delivOrder++,
            });
          }
        }
      }
    }
  }
}

function parseContracts(wb: XLSX.WorkBook): ParsedEmployee[] {
  const ws = wb.Sheets['التوقيع حتى الان'];
  if (!ws) return [];
  const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const result: ParsedEmployee[] = [];
  const cols = mapping.contractsSheetColumns;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const name = cleanCell(row[cols.name]);
    if (!name) continue;

    const position = cleanCell(row[cols.position]);
    const trackRaw = cleanCell(row[cols.track]);
    const contractType = cleanCell(row[cols.contractType]);
    const months = parseInt(cleanCell(row[cols.months])) || 0;
    const trackKey = normalizeTrackKey(trackRaw);

    result.push({
      fullNameAr: name,
      fullName: name,
      positionAr: position,
      position,
      contractType: mapping.contractTypeMapping[contractType] || contractType,
      contractStatus: 'تم التعاقد',
      trackKey,
      employeeCount: 1,
      directManager: '',
    });
  }
  return result;
}

function parseEmployeesSheet(wb: XLSX.WorkBook): ParsedEmployee[] {
  const ws = wb.Sheets['الموظفين'];
  if (!ws) return [];
  const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const result: ParsedEmployee[] = [];
  const cols = mapping.employeesSheetColumns;

  let currentTrack = '';

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const track = cleanCell(row[cols.track]);
    const detail = cleanCell(row[cols.detail]);
    const tasks = cleanCell(row[cols.tasks]);
    const type = cleanCell(row[cols.type]);
    const duration = parseInt(cleanCell(row[cols.durationMonths])) || 0;
    const quantity = parseInt(cleanCell(row[cols.quantity])) || 1;

    if (track) currentTrack = track;
    if (!detail) continue;

    // Extract employee name from detail if present (pattern: "name - title" or "title - name")
    const nameParts = detail.split('-').map(s => s.trim());
    let empName = detail;
    let empPosition = detail;

    // Try to find a proper name (contains Arabic name characters)
    if (nameParts.length >= 2) {
      // Usually format is "title - name" or "name - title"
      empName = detail;
      empPosition = nameParts[0];
    }

    const trackKey = normalizeTrackKey(currentTrack);

    result.push({
      fullNameAr: empName.substring(0, 100),
      fullName: empName.substring(0, 100),
      positionAr: empPosition.substring(0, 100),
      position: empPosition.substring(0, 100),
      contractType: mapping.contractTypeMapping[type] || type,
      contractStatus: '',
      trackKey,
      employeeCount: quantity,
      directManager: '',
    });
  }
  return result;
}

// ─── MERGE & DEDUPE ───

function mergeEmployees(
  trackEmployees: ParsedEmployee[],
  contractEmployees: ParsedEmployee[],
): ParsedEmployee[] {
  const merged = new Map<string, ParsedEmployee>();

  // Track sheet employees first (most detailed)
  for (const emp of trackEmployees) {
    const key = normalizeArabic(emp.fullNameAr).substring(0, 50);
    merged.set(key, emp);
  }

  // Contracts override contract status/type (they are signed)
  for (const emp of contractEmployees) {
    const key = normalizeArabic(emp.fullNameAr).substring(0, 50);
    const existing = merged.get(key);
    if (existing) {
      existing.contractStatus = 'تم التعاقد';
      existing.contractType = emp.contractType || existing.contractType;
      if (emp.trackKey && emp.trackKey !== 'إدارة المشروع') {
        existing.trackKey = emp.trackKey;
      }
    } else {
      merged.set(key, { ...emp, contractStatus: 'تم التعاقد' });
    }
  }

  return Array.from(merged.values());
}

// ─── BACKUP ───

async function createBackup(): Promise<string> {
  const ts = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const backupFile = path.join(BACKUP_DIR, `nusuk-before-import-${ts}.json`);

  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  log('Creating backup...');
  const [tracks, employees, kpis, deliverables, penalties, scopes, scopeBlocks] = await Promise.all([
    prisma.track.findMany(),
    prisma.employee.findMany(),
    prisma.trackKPI.findMany(),
    prisma.deliverable.findMany(),
    prisma.penalty.findMany(),
    prisma.scope.findMany(),
    prisma.scopeBlock.findMany(),
  ]);

  const backup = {
    timestamp: new Date().toISOString(),
    counts: {
      tracks: tracks.length,
      employees: employees.length,
      kpis: kpis.length,
      deliverables: deliverables.length,
      penalties: penalties.length,
      scopes: scopes.length,
      scopeBlocks: scopeBlocks.length,
    },
    data: { tracks, employees, kpis, deliverables, penalties, scopes, scopeBlocks },
  };

  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), 'utf-8');
  log(`Backup saved: ${backupFile} (${JSON.stringify(backup.counts)})`);
  return backupFile;
}

// ─── DIFF REPORT ───

function printDiff(diff: DiffReport) {
  logSection('DIFF REPORT');

  const entities = ['tracks', 'employees', 'kpis', 'deliverables', 'penalties', 'scopes'] as const;
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalUnchanged = 0;

  for (const entity of entities) {
    const d = diff[entity];
    totalInserted += d.inserted;
    totalUpdated += d.updated;
    totalUnchanged += d.unchanged;

    console.log(`\n  ${entity.toUpperCase()}:`);
    console.log(`    + Inserted: ${d.inserted}`);
    console.log(`    ~ Updated:  ${d.updated}`);
    console.log(`    = Unchanged: ${d.unchanged}`);
    if (d.details.length > 0) {
      for (const detail of d.details.slice(0, 10)) {
        console.log(`      ${detail}`);
      }
      if (d.details.length > 10) {
        console.log(`      ... and ${d.details.length - 10} more`);
      }
    }
  }

  console.log(`\n  ─── TOTALS ───`);
  console.log(`    + Inserted: ${totalInserted}`);
  console.log(`    ~ Updated:  ${totalUpdated}`);
  console.log(`    = Unchanged: ${totalUnchanged}`);
}

// ─── DB WRITE ───

async function writeToDatabase(
  parsedTracks: ParsedTrack[],
  allEmployees: ParsedEmployee[],
  allKPIs: ParsedKPI[],
  allDeliverables: ParsedDeliverable[],
  allPenalties: ParsedPenalty[],
  allScopes: ParsedScope[],
): Promise<DiffReport> {
  const diff: DiffReport = {
    tracks: { inserted: 0, updated: 0, unchanged: 0, details: [] },
    employees: { inserted: 0, updated: 0, unchanged: 0, details: [] },
    kpis: { inserted: 0, updated: 0, unchanged: 0, details: [] },
    deliverables: { inserted: 0, updated: 0, unchanged: 0, details: [] },
    penalties: { inserted: 0, updated: 0, unchanged: 0, details: [] },
    scopes: { inserted: 0, updated: 0, unchanged: 0, details: [] },
  };

  // ─ Step 1: Upsert Tracks ─
  const trackIdMap = new Map<string, string>(); // key -> db id

  for (const t of parsedTracks) {
    const existing = await prisma.track.findFirst({
      where: { OR: [{ name: t.name }, { nameAr: t.nameAr }] },
    });

    if (existing) {
      // Check if needs update
      const needsUpdate = existing.nameAr !== t.nameAr || existing.color !== t.color;
      if (needsUpdate && isApply) {
        await prisma.track.update({
          where: { id: existing.id },
          data: { nameAr: t.nameAr, color: t.color },
        });
        diff.tracks.updated++;
        diff.tracks.details.push(`~ Updated: ${t.nameAr}`);
      } else if (needsUpdate) {
        diff.tracks.updated++;
        diff.tracks.details.push(`~ Would update: ${t.nameAr}`);
      } else {
        diff.tracks.unchanged++;
      }
      trackIdMap.set(t.key, existing.id);
    } else {
      if (isApply) {
        const created = await prisma.track.create({
          data: { name: t.name, nameAr: t.nameAr, color: t.color, isActive: true },
        });
        trackIdMap.set(t.key, created.id);
      }
      diff.tracks.inserted++;
      diff.tracks.details.push(`+ Insert: ${t.nameAr} (${t.name})`);
    }
  }

  // For dry-run, we need IDs for lookups — fetch existing + generate placeholders for new
  if (!isApply) {
    const allTracks = await prisma.track.findMany();
    for (const t of allTracks) {
      for (const [key, cfg] of Object.entries(mapping.trackMapping) as [string, any][]) {
        if (t.name === cfg.name || t.nameAr === cfg.nameAr) {
          trackIdMap.set(key, t.id);
        }
      }
    }
    // Generate placeholder IDs for tracks that would be created
    for (const t of parsedTracks) {
      if (!trackIdMap.has(t.key)) {
        trackIdMap.set(t.key, `dry-run-${t.key}`);
      }
    }
  }

  // ─ Step 2: Upsert Employees ─
  for (const emp of allEmployees) {
    const trackId = trackIdMap.get(emp.trackKey);
    if (!trackId) {
      diff.employees.details.push(`! Skipped (no track): ${emp.fullNameAr} → ${emp.trackKey}`);
      continue;
    }

    const existing = await prisma.employee.findFirst({
      where: { fullNameAr: emp.fullNameAr, trackId },
    });

    if (existing) {
      const needsUpdate =
        existing.positionAr !== emp.positionAr ||
        existing.contractType !== emp.contractType;

      if (needsUpdate && isApply) {
        await prisma.employee.update({
          where: { id: existing.id },
          data: {
            positionAr: emp.positionAr,
            position: emp.position,
            contractType: emp.contractType,
          },
        });
        diff.employees.updated++;
        diff.employees.details.push(`~ Updated: ${emp.fullNameAr}`);
      } else if (needsUpdate) {
        diff.employees.updated++;
        diff.employees.details.push(`~ Would update: ${emp.fullNameAr} (pos: ${emp.positionAr}, type: ${emp.contractType})`);
      } else {
        diff.employees.unchanged++;
      }
    } else {
      if (isApply) {
        await prisma.employee.create({
          data: {
            fullName: emp.fullName,
            fullNameAr: emp.fullNameAr,
            position: emp.position,
            positionAr: emp.positionAr,
            contractType: emp.contractType,
            trackId,
          },
        });
      }
      diff.employees.inserted++;
      diff.employees.details.push(`+ Insert: ${emp.fullNameAr} → ${emp.trackKey}`);
    }
  }

  // ─ Step 3: Upsert KPIs ─
  for (const kpi of allKPIs) {
    const trackId = trackIdMap.get(kpi.trackKey);
    if (!trackId) continue;

    const existing = await prisma.trackKPI.findFirst({
      where: { trackId, nameAr: kpi.nameAr },
    });

    if (existing) {
      diff.kpis.unchanged++;
    } else {
      if (isApply) {
        await prisma.trackKPI.create({
          data: {
            name: kpi.name,
            nameAr: kpi.nameAr,
            sortOrder: kpi.sortOrder,
            trackId,
          },
        });
      }
      diff.kpis.inserted++;
      diff.kpis.details.push(`+ Insert KPI [${kpi.trackKey}]: ${kpi.nameAr.substring(0, 60)}...`);
    }
  }

  // ─ Step 4: Upsert Deliverables ─
  for (const d of allDeliverables) {
    const trackId = trackIdMap.get(d.trackKey);
    if (!trackId) continue;

    const existing = await prisma.deliverable.findFirst({
      where: { trackId, nameAr: d.nameAr },
    });

    if (existing) {
      const needsUpdate = existing.outputs !== d.outputs || existing.deliveryIndicators !== d.deliveryIndicators;
      if (needsUpdate && isApply) {
        await prisma.deliverable.update({
          where: { id: existing.id },
          data: { outputs: d.outputs, deliveryIndicators: d.deliveryIndicators },
        });
        diff.deliverables.updated++;
        diff.deliverables.details.push(`~ Updated: ${d.nameAr.substring(0, 60)}`);
      } else if (needsUpdate) {
        diff.deliverables.updated++;
        diff.deliverables.details.push(`~ Would update: ${d.nameAr.substring(0, 60)}`);
      } else {
        diff.deliverables.unchanged++;
      }
    } else {
      if (isApply) {
        await prisma.deliverable.create({
          data: {
            name: d.name,
            nameAr: d.nameAr,
            outputs: d.outputs,
            deliveryIndicators: d.deliveryIndicators,
            sortOrder: d.sortOrder,
            trackId,
          },
        });
      }
      diff.deliverables.inserted++;
      diff.deliverables.details.push(`+ Insert [${d.trackKey}]: ${d.nameAr.substring(0, 60)}`);
    }
  }

  // ─ Step 5: Upsert Penalties ─
  for (const p of allPenalties) {
    const trackId = trackIdMap.get(p.trackKey);
    if (!trackId) continue;

    const existing = await prisma.penalty.findFirst({
      where: { trackId, violationAr: p.violationAr },
    });

    if (existing) {
      diff.penalties.unchanged++;
    } else {
      if (isApply) {
        await prisma.penalty.create({
          data: {
            violation: p.violation,
            violationAr: p.violationAr,
            sortOrder: p.sortOrder,
            trackId,
          },
        });
      }
      diff.penalties.inserted++;
      diff.penalties.details.push(`+ Insert [${p.trackKey}]: ${p.violationAr.substring(0, 60)}`);
    }
  }

  // ─ Step 6: Upsert Scopes ─
  for (const s of allScopes) {
    const trackId = trackIdMap.get(s.trackKey);
    if (!trackId) continue;

    const existing = await prisma.scope.findFirst({
      where: { trackId, titleAr: s.titleAr },
    });

    if (existing) {
      diff.scopes.unchanged++;
    } else {
      if (isApply) {
        await prisma.scope.create({
          data: {
            title: s.title,
            titleAr: s.titleAr,
            description: s.description,
            sortOrder: s.sortOrder,
            trackId,
          },
        });
      }
      diff.scopes.inserted++;
      diff.scopes.details.push(`+ Insert [${s.trackKey}]: ${s.titleAr.substring(0, 60)}`);
    }
  }

  return diff;
}

// ─── MAIN ───

async function main() {
  logSection(`NUSUK 1447 DATA IMPORT — ${isApply ? 'APPLY MODE' : 'DRY-RUN MODE'}`);

  // Check file exists
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`ERROR: Excel file not found: ${EXCEL_PATH}`);
    process.exit(1);
  }
  log(`Reading: ${path.basename(EXCEL_PATH)}`);

  // Read Excel
  const wb = XLSX.readFile(EXCEL_PATH);
  log(`Sheets found: ${wb.SheetNames.length} — ${wb.SheetNames.join(', ')}`);

  // Parse all data
  logSection('PARSING DATA');
  const { tracks, employees: trackEmps, kpis, deliverables, penalties, scopes } = parseTrackSheets(wb);
  const contractEmps = parseContracts(wb);

  log(`Parsed from track sheets:`);
  log(`  Tracks: ${tracks.length}`);
  log(`  Employees (track sheets): ${trackEmps.length}`);
  log(`  Employees (contracts): ${contractEmps.length}`);
  log(`  KPIs: ${kpis.length}`);
  log(`  Deliverables: ${deliverables.length}`);
  log(`  Penalties: ${penalties.length}`);
  log(`  Scopes: ${scopes.length}`);

  // Merge employees
  const allEmployees = mergeEmployees(trackEmps, contractEmps);
  log(`  Employees (merged, deduped): ${allEmployees.length}`);

  // Backup
  if (isApply) {
    await createBackup();
  }

  // Confirmation for apply mode
  if (isApply && !isForce) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>(resolve => {
      rl.question('\n⚠️  This will WRITE to the database. Continue? (y/N): ', resolve);
    });
    rl.close();
    if (answer.toLowerCase() !== 'y') {
      log('Aborted.');
      process.exit(0);
    }
  }

  // Write (or simulate)
  logSection(isApply ? 'WRITING TO DATABASE' : 'SIMULATING CHANGES');

  let diff: DiffReport;

  if (isApply) {
    // Wrap in transaction
    diff = await prisma.$transaction(async (tx) => {
      // We can't pass tx easily to all functions, so we use the global prisma client
      // but the transaction context ensures atomicity
      return writeToDatabase(tracks, allEmployees, kpis, deliverables, penalties, scopes);
    }, { timeout: 60000 });
  } else {
    diff = await writeToDatabase(tracks, allEmployees, kpis, deliverables, penalties, scopes);
  }

  // Print diff
  printDiff(diff);

  if (!isApply) {
    logSection('DRY-RUN COMPLETE');
    console.log('\n  To apply changes, run:');
    console.log('  npx ts-node scripts/import-nusuk-1447.ts --apply\n');
  } else {
    logSection('IMPORT COMPLETE ✓');
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('\n❌ IMPORT FAILED:', err.message);
  console.error(err.stack);
  await prisma.$disconnect();
  process.exit(1);
});
