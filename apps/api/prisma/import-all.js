/**
 * Comprehensive Nusuk Platform Data Import from Excel
 * Source: نطاق العمل مازن 1447 هـ (1).xlsx
 *
 * Imports: Employees, Deliverables, KPIs, Penalties, Scopes, ScopeBlocks, Records
 * Cleans existing data first, then re-imports everything.
 */
const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');

const prisma = new PrismaClient();
const EXCEL_PATH = '/Users/mazin/Dash/نطاق العمل مازن 1447 هـ (1).xlsx';

// ──── Track sheet → DB track mapping ────
const TRACK_MAP = {
  'المسار الاستشاري':      'consulting',
  'مسار الطباعة ':          'printing',        // trailing space in Excel
  'مسار التوزيع':           'distribution',
  'مسار علاقات الشركات':    'corporate_relations',
  'مسار الدعم الفني':       'technical_support',
  'مسار التدريب':           'training',
};

// ──── Helper: clean text ────
function clean(val) {
  if (val === null || val === undefined) return '';
  return String(val).replace(/\r\n/g, '\n').trim();
}

// ──── Helper: split numbered text into individual items ────
function splitNumbered(text) {
  if (!text) return [];
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  const items = [];
  let current = '';
  for (const line of lines) {
    if (/^(\d+[\.\)]\s|•\s)/.test(line)) {
      if (current) items.push(current.trim());
      current = line.replace(/^(\d+[\.\)]\s*|•\s*)/, '').trim();
    } else {
      current += (current ? '\n' : '') + line;
    }
  }
  if (current) items.push(current.trim());
  return items.filter(i => i.length > 3);
}

// ──── Helper: parse scope items with hierarchy from c13/c14 ────
function parseScopeItems(rows, scopeCol) {
  const items = [];
  let currentSection = null;
  let orderIndex = 0;
  const usedCodes = new Set();

  function uniqueCode(base) {
    let code = base;
    let suffix = 1;
    while (usedCodes.has(code)) { code = base + '_' + suffix++; }
    usedCodes.add(code);
    return code;
  }

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const text = clean(row[scopeCol]);
    if (!text) continue;

    // Detect section headers like "1.1 خدمة طباعة", "1.5.1 مركز توزيع"
    const sectionMatch = text.match(/^(\d+(?:\.\d+)*)\s+(.+)/);
    if (sectionMatch) {
      const code = uniqueCode(sectionMatch[1]);
      currentSection = {
        code: code,
        title: sectionMatch[2],
        content: '',
        children: [],
        orderIndex: orderIndex++,
      };
      items.push(currentSection);
    } else if (currentSection) {
      // Add as child content
      const childCode = uniqueCode(currentSection.code + '.' + (currentSection.children.length + 1));
      currentSection.children.push({
        code: childCode,
        title: text.substring(0, 200),
        content: text,
        orderIndex: orderIndex++,
      });
    } else {
      // Standalone scope item
      const code = uniqueCode('R' + (orderIndex + 1));
      items.push({
        code: code,
        title: text.substring(0, 200),
        content: text,
        children: [],
        orderIndex: orderIndex++,
      });
    }
  }
  return items;
}

// ──── Parse a standard track sheet ────
function parseTrackSheet(rows) {
  const result = {
    description: '',
    employees: [],
    deliverables: [],
    kpis: [],
    penalties: [],
    scopeItems: [],
  };

  const seenEmployees = new Set();
  const seenKPIs = new Set();
  const seenPenalties = new Set();
  let deliverableOrder = 0;

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    // ── Employees (c2: position, c3: manager, c4: count, c5: name, c6: contract, c7: job desc) ──
    const position = clean(row[2]);
    const manager = clean(row[3]);
    const count = row[4] ? parseInt(row[4]) : 0;
    const empName = clean(row[5]);
    const contractStatus = clean(row[6]);
    const jobDesc = clean(row[7]);

    if (position && !seenEmployees.has(position)) {
      seenEmployees.add(position);
      const empCount = count || 1;
      // If multiple employees for same position, create entries
      if (empName && empName !== 'يحدد لاحقا') {
        result.employees.push({
          fullName: empName,
          fullNameAr: empName,
          position: position,
          positionAr: position,
          contractType: contractStatus.includes('متعاقد') ? 'contract' : 'full_time',
          status: contractStatus.includes('تم التعاقد') ? 'active' : 'inactive',
          notes: jobDesc || null,
          count: empCount,
          manager: manager,
        });
      } else if (empCount > 0) {
        // Position exists but name TBD
        for (let j = 0; j < Math.min(empCount, 1); j++) {
          result.employees.push({
            fullName: position,
            fullNameAr: position,
            position: position,
            positionAr: position,
            contractType: 'contract',
            status: 'inactive',
            notes: jobDesc ? jobDesc + (manager ? '\nالمدير المباشر: ' + manager : '') : null,
            count: empCount,
            manager: manager,
          });
        }
      }
    }

    // ── KPIs (c8) ──
    const kpiText = clean(row[8]);
    if (kpiText && !seenKPIs.has(kpiText.substring(0, 50))) {
      seenKPIs.add(kpiText.substring(0, 50));
      const kpiItems = splitNumbered(kpiText);
      for (const kpi of kpiItems) {
        result.kpis.push(kpi);
      }
    }

    // ── Deliverables (c9: item name, c10: outputs, c11: delivery indicators) ──
    const itemName = clean(row[9]);
    const outputs = clean(row[10]);
    const deliveryInd = clean(row[11]);
    if (itemName && itemName.length > 2) {
      result.deliverables.push({
        name: itemName,
        nameAr: itemName,
        outputs: outputs || null,
        deliveryIndicators: deliveryInd || null,
        sortOrder: deliverableOrder++,
      });
    }

    // ── Penalties (c12) ──
    const penaltyText = clean(row[12]);
    if (penaltyText && !seenPenalties.has(penaltyText.substring(0, 50))) {
      seenPenalties.add(penaltyText.substring(0, 50));
      const penItems = splitNumbered(penaltyText);
      for (const pen of penItems) {
        result.penalties.push(pen);
      }
    }
  }

  // ── Scope Items (c13 and c14 for consulting) ──
  result.scopeItems = parseScopeItems(rows, 13);

  // Also check c14 (consulting sheet has extended scope in c14)
  const c14Items = parseScopeItems(rows, 14);
  if (c14Items.length > 0) {
    // Prefix c14 codes to avoid collision with c13
    const existingCodes = new Set(result.scopeItems.map(s => s.code));
    for (const item of c14Items) {
      let code = item.code;
      while (existingCodes.has(code)) { code = 'S' + code; }
      existingCodes.add(code);
      item.code = code;
      if (item.children) {
        for (let ci = 0; ci < item.children.length; ci++) {
          item.children[ci].code = code + '.' + (ci + 1);
        }
      }
    }
    result.scopeItems = [...result.scopeItems, ...c14Items];
  }

  // ── Track description from first data row ──
  if (rows[2]) {
    const mainTrack = clean(rows[2][1]);
    const jobDescFirst = clean(rows[2][7]);
    result.description = mainTrack;
    result.descriptionFull = jobDescFirst;
  }

  // Deduplicate KPIs
  const uniqueKPIs = [...new Set(result.kpis)];
  result.kpis = uniqueKPIs;

  // Deduplicate penalties
  const uniquePenalties = [...new Set(result.penalties)];
  result.penalties = uniquePenalties;

  return result;
}

// ──── MAIN ────
async function main() {
  console.log('📖 Reading Excel file...');
  const wb = XLSX.readFile(EXCEL_PATH);

  // Get DB tracks
  const dbTracks = await prisma.track.findMany();
  const trackMap = {};
  for (const t of dbTracks) {
    trackMap[t.name] = t;
  }
  console.log('Database tracks:', dbTracks.map(t => t.name).join(', '));

  // Get admin user
  const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
  if (!admin) throw new Error('No admin user found');
  console.log('Using admin:', admin.email);

  // ──── STEP 1: Clean existing data ────
  console.log('\n🧹 Cleaning existing data...');

  const delSubtasks = await prisma.subtask.deleteMany();
  const delChecklist = await prisma.checklistItem.deleteMany();
  const delRecords = await prisma.record.deleteMany();
  const delEmployees = await prisma.employee.deleteMany();
  const delDeliverables = await prisma.deliverable.deleteMany();
  const delKPIs = await prisma.trackKPI.deleteMany();
  const delPenalties = await prisma.penalty.deleteMany();
  const delScopeBlocks = await prisma.scopeBlock.deleteMany();
  const delScopes = await prisma.scope.deleteMany();

  console.log(`  Deleted: ${delRecords.count} records, ${delEmployees.count} employees, ${delDeliverables.count} deliverables`);
  console.log(`  Deleted: ${delKPIs.count} KPIs, ${delPenalties.count} penalties, ${delScopes.count} scopes, ${delScopeBlocks.count} scope blocks`);

  // ──── STEP 2: Import each track ────
  const stats = {};

  for (const [sheetName, dbTrackName] of Object.entries(TRACK_MAP)) {
    const ws = wb.Sheets[sheetName];
    if (!ws) { console.log('\n⚠️  Sheet not found:', sheetName); continue; }

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const track = trackMap[dbTrackName];
    if (!track) { console.log('\n⚠️  Track not found in DB:', dbTrackName); continue; }

    const data = parseTrackSheet(rows);
    const trackStats = { employees: 0, deliverables: 0, records: 0, kpis: 0, penalties: 0, scopes: 0, scopeBlocks: 0 };

    console.log(`\n═══ ${track.nameAr} (${dbTrackName}) ═══`);

    // Update track description
    if (data.description) {
      await prisma.track.update({
        where: { id: track.id },
        data: {
          description: data.descriptionFull || data.description,
          descriptionAr: data.descriptionFull || data.description,
        },
      });
    }

    // ── Import Employees ──
    for (const emp of data.employees) {
      await prisma.employee.create({
        data: {
          trackId: track.id,
          fullName: emp.fullName,
          fullNameAr: emp.fullNameAr,
          position: emp.position,
          positionAr: emp.positionAr,
          contractType: emp.contractType,
          status: emp.status,
          notes: emp.notes,
        },
      });
      trackStats.employees++;
    }
    if (trackStats.employees) console.log(`  👥 ${trackStats.employees} employees`);

    // ── Import Deliverables ──
    for (const del of data.deliverables) {
      await prisma.deliverable.create({
        data: {
          trackId: track.id,
          name: del.name,
          nameAr: del.nameAr,
          outputs: del.outputs,
          deliveryIndicators: del.deliveryIndicators,
          sortOrder: del.sortOrder,
        },
      });
      trackStats.deliverables++;
    }
    if (trackStats.deliverables) console.log(`  📦 ${trackStats.deliverables} deliverables`);

    // ── Import KPIs ──
    let kpiOrder = 0;
    for (const kpi of data.kpis) {
      await prisma.trackKPI.create({
        data: {
          trackId: track.id,
          name: kpi,
          nameAr: kpi,
          sortOrder: kpiOrder++,
        },
      });
      trackStats.kpis++;
    }
    if (trackStats.kpis) console.log(`  📊 ${trackStats.kpis} KPIs`);

    // ── Import Penalties ──
    let penOrder = 0;
    for (const pen of data.penalties) {
      await prisma.penalty.create({
        data: {
          trackId: track.id,
          violation: pen,
          violationAr: pen,
          severity: pen.includes('2%') || pen.includes('20%') ? 'high' : pen.includes('1%') ? 'medium' : 'low',
          sortOrder: penOrder++,
        },
      });
      trackStats.penalties++;
    }
    if (trackStats.penalties) console.log(`  ⚠️  ${trackStats.penalties} penalties`);

    // ── Import Scope (one scope entry per track) ──
    if (data.scopeItems.length > 0) {
      const scope = await prisma.scope.create({
        data: {
          trackId: track.id,
          title: 'نطاق العمل - ' + track.nameAr,
          titleAr: 'نطاق العمل - ' + track.nameAr,
          description: 'نطاق العمل استنادا الى الكراسة - موسم حج 1447هـ',
          sortOrder: 0,
        },
      });
      trackStats.scopes++;

      // ── Import ScopeBlocks (hierarchical) ──
      for (const item of data.scopeItems) {
        const parent = await prisma.scopeBlock.create({
          data: {
            trackId: track.id,
            code: item.code,
            title: item.title,
            content: item.content || null,
            orderIndex: item.orderIndex,
            status: 'pending',
            progress: 0,
          },
        });
        trackStats.scopeBlocks++;

        // Create children
        if (item.children && item.children.length > 0) {
          for (const child of item.children) {
            await prisma.scopeBlock.create({
              data: {
                trackId: track.id,
                code: child.code,
                title: child.title,
                content: child.content || null,
                parentId: parent.id,
                orderIndex: child.orderIndex,
                status: 'pending',
                progress: 0,
              },
            });
            trackStats.scopeBlocks++;
          }
        }
      }
      console.log(`  📋 ${trackStats.scopes} scope, ${trackStats.scopeBlocks} scope blocks`);
    }

    // ── Import Records (one per deliverable) ──
    for (const del of data.deliverables) {
      const notesParts = [];
      if (del.outputs) notesParts.push('المخرجات: ' + del.outputs);
      if (del.deliveryIndicators) notesParts.push('مؤشرات التسليم: ' + del.deliveryIndicators);

      await prisma.record.create({
        data: {
          trackId: track.id,
          title: del.name,
          titleAr: del.nameAr,
          status: 'draft',
          priority: 'medium',
          progress: 0,
          notes: notesParts.join('\n\n') || null,
          createdById: admin.id,
          extraFields: {
            outputs: del.outputs,
            deliveryIndicators: del.deliveryIndicators,
          },
        },
      });
      trackStats.records++;
    }
    if (trackStats.records) console.log(`  📝 ${trackStats.records} records`);

    stats[track.nameAr] = trackStats;
  }

  // ──── STEP 3: Import additional sheets ────

  // Cameras sheet → technical_support
  const camSheet = wb.Sheets['مسار كاميرات النوارية'];
  if (camSheet) {
    const camRows = XLSX.utils.sheet_to_json(camSheet, { header: 1 });
    const techTrack = trackMap['technical_support'];
    if (techTrack && camRows.length > 1) {
      console.log('\n═══ كاميرات النوارية → مسار الدعم الفني ═══');

      const camTitle = clean(camRows[1][3]) || 'تشغيل كاميرات مركز تفويج النوارية';
      const camIndicators = clean(camRows[1][5]);
      const camKPIs = clean(camRows[2] ? camRows[2][10] : '');

      // Deliverable
      await prisma.deliverable.create({
        data: {
          trackId: techTrack.id,
          name: camTitle,
          nameAr: camTitle,
          outputs: camTitle,
          deliveryIndicators: camIndicators,
          sortOrder: 100,
        },
      });

      // Record
      await prisma.record.create({
        data: {
          trackId: techTrack.id,
          title: camTitle,
          titleAr: camTitle,
          status: 'draft',
          priority: 'medium',
          progress: 0,
          notes: camIndicators ? 'مؤشرات التسليم: ' + camIndicators : null,
          createdById: admin.id,
        },
      });

      // KPIs from cameras
      if (camKPIs) {
        const kpiItems = splitNumbered(camKPIs);
        for (const kpi of kpiItems) {
          await prisma.trackKPI.create({
            data: { trackId: techTrack.id, name: kpi, nameAr: kpi, sortOrder: 100 },
          });
        }
        console.log(`  📊 ${kpiItems.length} KPIs`);
      }
      console.log('  📦 1 deliverable, 📝 1 record');
    }
  }

  // ──── STEP 4: Import الموظفين sheet (global employee list) ────
  const empSheet = wb.Sheets['الموظفين'];
  if (empSheet) {
    console.log('\n═══ استيراد الموظفين الإضافيين ═══');
    const empRows = XLSX.utils.sheet_to_json(empSheet, { header: 1 });
    let empImported = 0;

    // Map track names to DB
    const empTrackMap = {
      'فريق ادارة المشروع': null, // no specific track, skip or assign to consulting
      'مسار التدريب': 'training',
      'المسار الاستشاري': 'consulting',
      'مسار الدعم الفني': 'technical_support',
      'مسار لوحة البيانات': 'consulting',
      'مسار علاقات الشركات': 'corporate_relations',
      'مسار الطباعة': 'printing',
      'مسار التوزيع': 'distribution',
    };

    for (let i = 1; i < empRows.length; i++) {
      const row = empRows[i];
      if (!row) continue;

      const trackName = clean(row[1]);
      const itemDetail = clean(row[2]);
      const tasks = clean(row[3]);
      const type = clean(row[4]);
      const duration = row[5] ? String(row[5]) : '';
      const qty = row[6] ? parseInt(row[6]) : 1;

      if (!itemDetail) continue;

      // Find track
      let dbTrackName = null;
      for (const [key, val] of Object.entries(empTrackMap)) {
        if (trackName && trackName.includes(key.replace('مسار ', ''))) {
          dbTrackName = val;
          break;
        }
      }
      // Also match from column 1
      if (!dbTrackName && trackName) {
        for (const [key, val] of Object.entries(empTrackMap)) {
          if (key.includes(trackName) || trackName.includes(key)) {
            dbTrackName = val;
            break;
          }
        }
      }

      const trackObj = dbTrackName ? trackMap[dbTrackName] : null;

      // Extract name from itemDetail
      const nameMatch = itemDetail.match(/[-–]\s*(.+?)(?:\s*[-–]|$)/);
      const empName = nameMatch ? nameMatch[1].trim() : itemDetail;

      await prisma.employee.create({
        data: {
          trackId: trackObj ? trackObj.id : null,
          fullName: empName,
          fullNameAr: empName,
          position: itemDetail,
          positionAr: itemDetail,
          contractType: type.includes('متعاقد') ? 'contract' : 'full_time',
          status: 'active',
          notes: [
            tasks ? 'المهام: ' + tasks : '',
            duration ? 'المدة: ' + duration + ' شهر' : '',
            qty > 1 ? 'العدد: ' + qty : '',
          ].filter(Boolean).join('\n'),
        },
      });
      empImported++;
    }
    console.log(`  👥 ${empImported} employees imported from الموظفين sheet`);
  }

  // ──── Summary ────
  console.log('\n' + '═'.repeat(50));
  console.log('✅ Import complete! Summary:');
  console.log('═'.repeat(50));

  let totalRecords = 0, totalEmps = 0, totalDels = 0, totalKPIs = 0, totalPens = 0, totalScopes = 0;
  for (const [trackName, s] of Object.entries(stats)) {
    console.log(`\n  ${trackName}:`);
    console.log(`    👥 ${s.employees} employees | 📦 ${s.deliverables} deliverables | 📝 ${s.records} records`);
    console.log(`    📊 ${s.kpis} KPIs | ⚠️  ${s.penalties} penalties | 📋 ${s.scopeBlocks} scope blocks`);
    totalRecords += s.records;
    totalEmps += s.employees;
    totalDels += s.deliverables;
    totalKPIs += s.kpis;
    totalPens += s.penalties;
    totalScopes += s.scopeBlocks;
  }

  console.log(`\n  TOTAL: ${totalEmps} employees, ${totalDels} deliverables, ${totalRecords} records`);
  console.log(`         ${totalKPIs} KPIs, ${totalPens} penalties, ${totalScopes} scope blocks`);
}

main()
  .catch(e => {
    console.error('\n❌ Error:', e.message);
    console.error(e.stack);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
