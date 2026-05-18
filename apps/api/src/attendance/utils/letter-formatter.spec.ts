import {
  buildLetter,
  formatAbsenceLine,
  formatArabicDate,
  formatHoursWorked,
  pluralizeHours,
  toArabicIndic,
  areDatesContinuous,
  deriveShortName,
  AbsenceEntry,
  DEFAULT_RECIPIENT,
} from './letter-formatter';

const utc = (yyyymmdd: string) => new Date(`${yyyymmdd}T00:00:00.000Z`);

describe('formatArabicDate', () => {
  it('returns "DD MONTH YYYY" with year', () => {
    expect(formatArabicDate(utc('2026-04-24'), true)).toBe('24 أبريل 2026');
    expect(formatArabicDate(utc('2026-01-09'), true)).toBe('9 يناير 2026');
    expect(formatArabicDate(utc('2026-12-31'), true)).toBe('31 ديسمبر 2026');
  });

  it('drops the year when withYear=false', () => {
    expect(formatArabicDate(utc('2026-04-24'), false)).toBe('24 أبريل');
    expect(formatArabicDate(utc('2026-09-15'), false)).toBe('15 سبتمبر');
  });
});

describe('areDatesContinuous', () => {
  it('returns true for consecutive days', () => {
    expect(areDatesContinuous([utc('2026-04-09'), utc('2026-04-10'), utc('2026-04-11')])).toBe(true);
  });

  it('returns false when there is a gap', () => {
    expect(areDatesContinuous([utc('2026-04-09'), utc('2026-04-11')])).toBe(false);
    expect(areDatesContinuous([utc('2026-04-09'), utc('2026-04-15'), utc('2026-04-22')])).toBe(false);
  });

  it('handles single-element and empty arrays', () => {
    expect(areDatesContinuous([utc('2026-04-09')])).toBe(true);
    expect(areDatesContinuous([])).toBe(true);
  });

  it('correctly spans month boundaries', () => {
    expect(areDatesContinuous([utc('2026-04-30'), utc('2026-05-01')])).toBe(true);
  });
});

describe('deriveShortName', () => {
  it('shortens 3+ token names to first + last', () => {
    expect(deriveShortName('فراس زهير فقيها')).toBe('فراس فقيها');
    expect(deriveShortName('عبدالرحمن عبدالله المالكي')).toBe('عبدالرحمن المالكي');
  });

  it('strips honorifics before shortening', () => {
    expect(deriveShortName('م. حامد الصايغ')).toBe('حامد الصايغ');
    expect(deriveShortName('د. حسام فقيها')).toBe('حسام فقيها');
    expect(deriveShortName('الدكتور أحمد بخاري')).toBe('أحمد بخاري');
  });

  it('keeps 2-token names as-is', () => {
    expect(deriveShortName('محمد المالكي')).toBe('محمد المالكي');
  });
});

describe('formatAbsenceLine', () => {
  const base = { employeeId: 'x', fullName: 'فراس فقيها', track: 'التوزيع' };

  it('Test 2: single-day absence → name (track)، بتاريخ DD MONTH YYYY', () => {
    const a: AbsenceEntry = { ...base, absenceDates: [utc('2026-04-24')] };
    expect(formatAbsenceLine(a)).toBe('فراس فقيها (التوزيع)، بتاريخ 24 أبريل 2026.');
  });

  it('Test 1: continuous range → name (track)، وذلك خلال الفترة من DD MONTH وحتى DD MONTH', () => {
    const dates = Array.from({ length: 15 }, (_, i) =>
      utc(`2026-04-${String(9 + i).padStart(2, '0')}`),
    );
    const a: AbsenceEntry = { ...base, absenceDates: dates };
    expect(formatAbsenceLine(a)).toBe(
      'فراس فقيها (التوزيع)، وذلك خلال الفترة من 9 أبريل وحتى 23 أبريل.',
    );
  });

  it('Test 3: 3 scattered dates → بتواريخ: A، B، وC', () => {
    const a: AbsenceEntry = {
      ...base,
      absenceDates: [utc('2026-04-09'), utc('2026-04-15'), utc('2026-04-22')],
    };
    expect(formatAbsenceLine(a)).toBe(
      'فراس فقيها (التوزيع)، بتواريخ: 9 أبريل، 15 أبريل، و22 أبريل.',
    );
  });

  it('2 scattered dates → بتاريخَي A وB', () => {
    const a: AbsenceEntry = {
      ...base,
      absenceDates: [utc('2026-04-09'), utc('2026-04-15')],
    };
    expect(formatAbsenceLine(a)).toBe('فراس فقيها (التوزيع)، بتاريخَي 9 أبريل و15 أبريل.');
  });

  it('omits the (track) suffix when track is empty', () => {
    const a: AbsenceEntry = { ...base, track: '', absenceDates: [utc('2026-04-24')] };
    expect(formatAbsenceLine(a)).toBe('فراس فقيها، بتاريخ 24 أبريل 2026.');
  });

  it('uses shortName when provided', () => {
    const a: AbsenceEntry = {
      ...base,
      fullName: 'فراس زهير فقيها',
      shortName: 'فراس فقيها',
      absenceDates: [utc('2026-04-24')],
    };
    expect(formatAbsenceLine(a)).toBe('فراس فقيها (التوزيع)، بتاريخ 24 أبريل 2026.');
  });

  it('sorts dates before formatting', () => {
    const a: AbsenceEntry = {
      ...base,
      absenceDates: [utc('2026-04-22'), utc('2026-04-09'), utc('2026-04-15')],
    };
    expect(formatAbsenceLine(a)).toBe(
      'فراس فقيها (التوزيع)، بتواريخ: 9 أبريل، 15 أبريل، و22 أبريل.',
    );
  });
});

describe('buildLetter', () => {
  it('Test 4: multiple employees on the same day', () => {
    const letter = buildLetter({
      recipientName: DEFAULT_RECIPIENT,
      reportType: 'daily',
      reportDate: utc('2026-04-17'),
      absences: [
        { employeeId: 'a', fullName: 'فراس فقيها', track: 'التوزيع', absenceDates: [utc('2026-04-17')] },
        { employeeId: 'b', fullName: 'محمد المالكي', track: 'التوزيع', absenceDates: [utc('2026-04-17')] },
      ],
    });
    expect(letter.text).toContain('فراس فقيها (التوزيع)، بتاريخ 17 أبريل 2026.');
    expect(letter.text).toContain('محمد المالكي (التوزيع)، بتاريخ 17 أبريل 2026.');
    expect(letter.metadata.uniqueEmployees).toBe(2);
    expect(letter.metadata.totalAbsences).toBe(2);
  });

  it('Test 5: no absences for a single day', () => {
    const letter = buildLetter({
      recipientName: DEFAULT_RECIPIENT,
      reportType: 'daily',
      reportDate: utc('2026-04-17'),
      absences: [],
    });
    expect(letter.text).toContain(
      'نفيد سعادتكم بأنه تم مراجعة كشف الحضور والانصراف لجميع المسارات، ولم يتم تسجيل أي حالات غياب بتاريخ 17 أبريل 2026.',
    );
    expect(letter.text).not.toContain('على النحو التالي');
    expect(letter.metadata.totalAbsences).toBe(0);
  });

  it('Test 6: no absences for a range', () => {
    const letter = buildLetter({
      recipientName: DEFAULT_RECIPIENT,
      reportType: 'range',
      rangeStart: utc('2026-04-15'),
      rangeEnd: utc('2026-04-20'),
      absences: [],
    });
    expect(letter.text).toContain(
      'نفيد سعادتكم بأنه تم مراجعة كشف الحضور والانصراف لجميع المسارات، ولم يتم تسجيل أي حالات غياب خلال الفترة من 15 أبريل وحتى 20 أبريل 2026.',
    );
  });

  it('Test 1 (full): range report with continuous absence + last-day note', () => {
    // 9-23 April: absent every day. Range is 9-24, last day (24) had no absence.
    const dates = Array.from({ length: 15 }, (_, i) =>
      utc(`2026-04-${String(9 + i).padStart(2, '0')}`),
    );
    const letter = buildLetter({
      recipientName: DEFAULT_RECIPIENT,
      reportType: 'range',
      rangeStart: utc('2026-04-09'),
      rangeEnd: utc('2026-04-24'),
      noteAboutLastDay: true,
      absences: [
        {
          employeeId: 'x',
          fullName: 'فراس زهير فقيها',
          shortName: 'فراس فقيها',
          track: 'التوزيع',
          absenceDates: dates,
        },
      ],
    });
    // The absence line uses the actual last absence (23 April), not the range end (24).
    // The "no absence on last day" note says 24 April. Together this matches the
    // user's intent — and is internally consistent (the spec's expected text had
    // "حتى 24 أبريل" in the range line which contradicts "absent through 23").
    expect(letter.text).toContain(
      'فراس فقيها (التوزيع)، وذلك خلال الفترة من 9 أبريل وحتى 23 أبريل.',
    );
    expect(letter.text).toContain(
      'كما نود الإشارة إلى أنه لا توجد أي حالات غياب بتاريخ 24 أبريل.',
    );
    expect(letter.text).toContain('سعادة الدكتور/ حسام فقيها،');
    expect(letter.text.endsWith('وتفضلوا بقبول فائق التحية والتقدير.')).toBe(true);
  });

  it('omits the last-day note when noteAboutLastDay is false', () => {
    const letter = buildLetter({
      recipientName: DEFAULT_RECIPIENT,
      reportType: 'range',
      rangeStart: utc('2026-04-09'),
      rangeEnd: utc('2026-04-24'),
      noteAboutLastDay: false,
      absences: [
        { employeeId: 'x', fullName: 'فراس فقيها', track: 'التوزيع', absenceDates: [utc('2026-04-15')] },
      ],
    });
    expect(letter.text).not.toContain('لا توجد أي حالات غياب بتاريخ');
  });

  it('html output is escaped and uses <p> tags', () => {
    const letter = buildLetter({
      recipientName: 'X<script>',
      reportType: 'daily',
      reportDate: utc('2026-04-17'),
      absences: [],
    });
    expect(letter.html).toContain('&lt;script&gt;');
    expect(letter.html).toContain('<p>');
    expect(letter.html).not.toContain('<script>');
  });
});

// ─── v2 (3-category) layout ───────────────────────────────────────────

describe('toArabicIndic', () => {
  it('maps each digit to its Arabic-Indic counterpart', () => {
    expect(toArabicIndic(0)).toBe('٠');
    expect(toArabicIndic(123456789)).toBe('١٢٣٤٥٦٧٨٩');
    expect(toArabicIndic('6.5')).toBe('٦.٥');
  });
  it('leaves non-digit characters untouched', () => {
    expect(toArabicIndic('5 ساعات')).toBe('٥ ساعات');
  });
});

describe('pluralizeHours', () => {
  it.each<[number, string]>([
    [0, 'ساعة'],
    [0.5, 'ساعة'],
    [1, 'ساعة'],
    [1.9, 'ساعة'],
    [2, 'ساعتان'],
    [2.5, 'ساعات'],
    [6.5, 'ساعات'],
    [7.9, 'ساعات'],
  ])('h=%s → %s', (h, expected) => {
    expect(pluralizeHours(h)).toBe(expected);
  });
});

describe('formatHoursWorked', () => {
  it('renders Arabic-Indic digits with one decimal when fractional', () => {
    expect(formatHoursWorked(6.5)).toBe('٦.٥ ساعات');
    expect(formatHoursWorked(4.2)).toBe('٤.٢ ساعات');
  });
  it('omits the trailing ".0" for whole numbers', () => {
    expect(formatHoursWorked(7)).toBe('٧ ساعات');
    expect(formatHoursWorked(2)).toBe('٢ ساعتان');
  });
  it('rounds away tiny float noise to a single decimal', () => {
    // 6.4999... appears routinely in Float arithmetic — must read as 6.5.
    expect(formatHoursWorked(6.499999)).toBe('٦.٥ ساعات');
  });
  it('handles sub-2 values with the singular form', () => {
    expect(formatHoursWorked(1.5)).toBe('١.٥ ساعة');
    expect(formatHoursWorked(0.5)).toBe('٠.٥ ساعة');
  });
});

describe('buildLetter — v2 (3-category) layout', () => {
  const baseCtx = (over: Partial<Parameters<typeof buildLetter>[0]> = {}) =>
    buildLetter({
      recipientName: DEFAULT_RECIPIENT,
      reportType: 'daily' as const,
      reportDate: utc('2026-04-24'),
      absences: [],
      partial: [],
      missingCheckout: [],
      ...over,
    });

  it('renders three section headers + "لا يوجد" in every section when empty', () => {
    const letter = baseCtx();
    expect(letter.text).toContain('أولاً: الموظفون الغائبون كلياً');
    expect(letter.text).toContain('ثانياً: الدوام الجزئي (أقل من 8 ساعات)');
    expect(letter.text).toContain('ثالثاً: البصمة الناقصة (دخول بدون خروج)');
    // Three "لا يوجد" — one per empty section.
    expect(letter.text.match(/لا يوجد/g)?.length).toBe(3);
  });

  it('mentions the on-call exclusion in the intro', () => {
    const letter = baseCtx();
    expect(letter.text).toContain('موظفي On Call غير مشمولين في هذا التقرير');
  });

  it('numbers items with Arabic-Indic digits and shows the track in parentheses', () => {
    const letter = baseCtx({
      absences: [
        { employeeId: 'a', fullName: 'فراس فقيها', shortName: 'فراس فقيها', track: 'الطباعة', absenceDates: [utc('2026-04-24')] },
        { employeeId: 'b', fullName: 'محمد المالكي', shortName: 'محمد المالكي', track: 'التوزيع', absenceDates: [utc('2026-04-24')] },
      ],
    });
    expect(letter.text).toContain('١. فراس فقيها (الطباعة)');
    expect(letter.text).toContain('٢. محمد المالكي (التوزيع)');
  });

  it('renders partial-attendance lines with hours formatted in Arabic-Indic', () => {
    const letter = baseCtx({
      partial: [
        { employeeId: 'a', fullName: 'سعيد العمري', shortName: 'سعيد العمري', track: 'الكاميرات', hoursWorked: 6.5 },
        { employeeId: 'b', fullName: 'حامد الصايغ', shortName: 'حامد الصايغ', track: 'التدريب', hoursWorked: 4.2 },
      ],
    });
    expect(letter.text).toContain('١. سعيد العمري (الكاميرات) — ٦.٥ ساعات');
    expect(letter.text).toContain('٢. حامد الصايغ (التدريب) — ٤.٢ ساعات');
  });

  it('renders missing-checkout entries by name only (no hours)', () => {
    const letter = baseCtx({
      missingCheckout: [
        { employeeId: 'a', fullName: 'خالد العتيبي', shortName: 'خالد العتيبي', track: 'الطباعة' },
      ],
    });
    expect(letter.text).toContain('١. خالد العتيبي (الطباعة)');
    expect(letter.text).not.toContain('ساعة'); // never has hours in this section
  });

  it('shows "لا يوجد" only for empty sections (mixed-fill case)', () => {
    const letter = baseCtx({
      absences: [
        { employeeId: 'a', fullName: 'فراس فقيها', shortName: 'فراس فقيها', track: 'الطباعة', absenceDates: [utc('2026-04-24')] },
      ],
      // partial empty, missing empty
    });
    expect(letter.text.match(/لا يوجد/g)?.length).toBe(2);
  });

  it('populates `categoryCounts` and the unified counts on metadata', () => {
    const letter = baseCtx({
      absences: [
        { employeeId: 'a', fullName: 'فراس فقيها', shortName: 'فراس', track: 'A', absenceDates: [utc('2026-04-24')] },
        { employeeId: 'b', fullName: 'حامد الصايغ', shortName: 'حامد', track: 'A', absenceDates: [utc('2026-04-24')] },
      ],
      partial: [
        { employeeId: 'c', fullName: 'سعيد العمري', shortName: 'سعيد', track: 'B', hoursWorked: 6.5 },
      ],
      missingCheckout: [
        { employeeId: 'd', fullName: 'خالد العتيبي', shortName: 'خالد', track: 'B' },
        { employeeId: 'e', fullName: 'مازن', shortName: 'مازن', track: 'C' },
      ],
    });
    expect(letter.metadata.categoryCounts).toEqual({ absent: 2, partial: 1, missingCheckout: 2 });
    expect(letter.metadata.uniqueEmployees).toBe(5);
    expect(letter.metadata.totalAbsences).toBe(5);
  });
});

describe('buildLetter — backward compat (no partial / missingCheckout)', () => {
  it('renders the legacy single-section layout when only `absences` is provided', () => {
    const letter = buildLetter({
      recipientName: DEFAULT_RECIPIENT,
      reportType: 'range',
      rangeStart: utc('2026-04-09'),
      rangeEnd: utc('2026-04-24'),
      absences: [
        { employeeId: 'a', fullName: 'فراس فقيها', shortName: 'فراس فقيها', track: 'الطباعة', absenceDates: [utc('2026-04-10')] },
      ],
    });
    // Legacy layout: no section headers, no on-call note, no categoryCounts.
    expect(letter.text).not.toContain('أولاً:');
    expect(letter.text).not.toContain('موظفي On Call');
    expect(letter.metadata.categoryCounts).toBeUndefined();
  });
});
