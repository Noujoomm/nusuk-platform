"""
Import data from نطاق العمل مازن 1447 هـ (1).xlsx into the NUSUK platform database.
Reads all sheets and populates: employees, contracts, deliverables, KPIs, penalties, scopes, financial costs.
Also creates records from the main plan for each employee.
"""
import sys
import os
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime

EXCEL_PATH = os.environ.get("EXCEL_PATH", "/Users/mazin/Dash/نطاق العمل مازن 1447 هـ (1).xlsx")
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://nusuk:nusuk_secret@localhost:5432/nusuk_db")

# ─── Track mapping ───
TRACK_MAP = {
    "المسار الاستشاري": "consulting",
    "مسار الطباعة": "printing",
    "مسار التوزيع": "distribution",
    "مسار علاقات الشركات": "corporate_relations",
    "مسار الدعم الفني": "technical_support",
    "مسار التدريب": "training",
    "مسار كاميرات النوارية": "cameras_nawaria",
    "مسار إدارة المشروع": "project_management",
    "مسار البيانات": "data_management",
}

TRACK_COLORS = {
    "consulting": "#10B981",
    "printing": "#0EA5E9",
    "distribution": "#8B5CF6",
    "corporate_relations": "#F59E0B",
    "technical_support": "#F43F5E",
    "training": "#14B8A6",
    "cameras_nawaria": "#6366F1",
    "project_management": "#EC4899",
    "data_management": "#06B6D4",
}

# Map main plan track names
MAIN_PLAN_MAP = {
    "إدارة المشروع": "project_management",
    "المراقبة التشغيلية والخدمات الاستشارية": "consulting",
    "الطباعة والتغليف": "printing",
    "التوزيع": "distribution",
    "الدعم الفني والإداري": "technical_support",
    "التدريب": "training",
    "العلاقات المؤسسية": "corporate_relations",
    "علاقات الشركات": "corporate_relations",
}

# Map contract track names
CONTRACT_TRACK_MAP = {
    "الاستشاري": "consulting",
    "التوزيع": "distribution",
    "إدارة المشروع": "project_management",
    "علاقات شركات": "corporate_relations",
    "موظف لدى العميل": "project_management",
    "الدعم الفني": "technical_support",
    "الطباعة": "printing",
    "التدريب": "training",
}


def clean(val):
    """Clean a cell value."""
    if pd.isna(val):
        return None
    s = str(val).strip()
    if s in ("", "nan", "NaN", "None"):
        return None
    return s


def gen_cuid():
    """Simple cuid-like ID generator."""
    import random, string, time
    ts = hex(int(time.time() * 1000))[2:]
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=12))
    return f"c{ts}{rand}"


def main():
    print("\n" + "=" * 60)
    print("  NUSUK — Excel Data Import")
    print("=" * 60)

    # Connect
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # Load Excel
    print(f"\nLoading: {os.path.basename(EXCEL_PATH)}")
    xls = pd.ExcelFile(EXCEL_PATH)
    raw = {n: pd.read_excel(xls, n) for n in xls.sheet_names}

    # ─── 1. Ensure all tracks exist ───
    print("\n1. Ensuring tracks...")
    track_ids = {}  # name -> id

    # Get existing tracks
    cur.execute("SELECT id, name FROM tracks")
    for row in cur.fetchall():
        track_ids[row[1]] = row[0]

    # Create missing tracks
    sort_order = len(track_ids)
    for sheet_ar, name_en in TRACK_MAP.items():
        if name_en not in track_ids:
            tid = gen_cuid()
            color = TRACK_COLORS.get(name_en, "#94A3B8")
            cur.execute(
                """INSERT INTO tracks (id, name, name_ar, color, sort_order, is_active, created_at, updated_at)
                   VALUES (%s, %s, %s, %s, %s, true, NOW(), NOW())""",
                (tid, name_en, sheet_ar, color, sort_order),
            )
            track_ids[name_en] = tid
            sort_order += 1
            print(f"  Created track: {sheet_ar} ({name_en})")

    conn.commit()

    # Get admin user ID for records
    cur.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
    admin_row = cur.fetchone()
    admin_id = admin_row[0] if admin_row else None

    # ─── 2. Import Main Plan (الخطة الرئيسية) ───
    print("\n2. Importing main plan employees...")
    mp = raw["الخطة الرئيسية"].copy()
    mp.columns = [
        "#", "المسار الرئيسي", "المسمى الوظيفي", "قائد المسار", "المسار الفرعي",
        "الوظيفة", "المدير المباشر", "العدد", "الموظف", "حالة التعاقد",
        "الوصف الوظيفي", "KPI", "المخرجات", "الغرامات",
    ]
    for c in ["المسار الرئيسي", "المسار الفرعي", "قائد المسار", "المدير المباشر"]:
        mp[c] = mp[c].ffill()

    emp_count = 0
    record_count = 0
    for _, row in mp.iterrows():
        emp_name = clean(row["الموظف"])
        if not emp_name or emp_name == "يحدد لاحقا":
            continue

        # Find track
        main_track = clean(row["المسار الرئيسي"]) or ""
        track_en = None
        for key, val in MAIN_PLAN_MAP.items():
            if key in main_track:
                track_en = val
                break
        track_id = track_ids.get(track_en) if track_en else None

        eid = gen_cuid()
        cur.execute(
            """INSERT INTO employees (id, track_id, full_name, full_name_ar, position_ar,
               sub_track, direct_manager, contract_status, job_description, kpi_text, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())""",
            (
                eid, track_id, emp_name, emp_name,
                clean(row["الوظيفة"]),
                clean(row["المسار الفرعي"]),
                clean(row["المدير المباشر"]),
                clean(row["حالة التعاقد"]),
                clean(row["الوصف الوظيفي"]),
                clean(row["KPI"]),
            ),
        )
        emp_count += 1

        # Create a record for this employee in their track
        if track_id and admin_id:
            position = clean(row["الوظيفة"]) or emp_name
            status = "active" if clean(row["حالة التعاقد"]) == "تم التعاقد" else "draft"
            rid = gen_cuid()
            extra = {
                "employeeId": eid,
                "position": clean(row["الوظيفة"]),
                "subTrack": clean(row["المسار الفرعي"]),
                "manager": clean(row["المدير المباشر"]),
                "contractStatus": clean(row["حالة التعاقد"]),
            }
            import json
            cur.execute(
                """INSERT INTO records (id, track_id, title, title_ar, status, priority, owner,
                   progress, extra_fields, version, created_by_id, created_at, updated_at)
                   VALUES (%s, %s, %s, %s, %s, 'medium', %s, %s, %s, 1, %s, NOW(), NOW())""",
                (
                    rid, track_id, position, f"{emp_name} - {position}",
                    status, emp_name,
                    100.0 if status == "active" else 0.0,
                    json.dumps(extra, ensure_ascii=False),
                    admin_id,
                ),
            )
            record_count += 1

    print(f"  Imported {emp_count} employees, created {record_count} records")
    conn.commit()

    # ─── 3. Import Track Sheets (team + deliverables + KPI + penalties + scope) ───
    print("\n3. Importing track-specific data...")

    TRACK_SHEETS = {
        "المسار الاستشاري": "consulting",
        "مسار الطباعة ": "printing",  # Note trailing space
        "مسار التوزيع": "distribution",
        "مسار علاقات الشركات": "corporate_relations",
        "مسار الدعم الفني": "technical_support",
        "مسار التدريب": "training",
        "مسار إدارة المشروع": "project_management",
    }

    for sheet_name, track_en in TRACK_SHEETS.items():
        if sheet_name not in raw and sheet_name.strip() not in raw:
            # Try with/without trailing space
            alt = sheet_name.strip()
            if alt in raw:
                sheet_name = alt
            else:
                continue

        df = raw[sheet_name]
        track_id = track_ids.get(track_en)
        if not track_id:
            continue

        ncols = len(df.columns)
        print(f"\n  [{track_en}] {ncols} cols, {len(df)} rows")

        # Deliverables (cols 9-11 in 14-col sheets: name, outputs, indicators)
        if ncols >= 12:
            deliv_count = 0
            for idx, (_, row) in enumerate(df.iloc[1:].iterrows()):
                name = clean(row.iloc[9]) if ncols > 9 else None
                if not name:
                    continue
                outputs = clean(row.iloc[10]) if ncols > 10 else None
                indicators = clean(row.iloc[11]) if ncols > 11 else None

                did = gen_cuid()
                cur.execute(
                    """INSERT INTO deliverables (id, track_id, name, name_ar, outputs, delivery_indicators, sort_order, created_at)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())""",
                    (did, track_id, name, name, outputs, indicators, idx),
                )
                deliv_count += 1
            if deliv_count:
                print(f"    Deliverables: {deliv_count}")

        # KPIs (col 8)
        if ncols >= 9:
            kpi_texts = set()
            for _, row in df.iloc[1:].iterrows():
                kpi = clean(row.iloc[8])
                if kpi and kpi not in kpi_texts:
                    kpi_texts.add(kpi)

            for idx, kpi in enumerate(kpi_texts):
                kid = gen_cuid()
                cur.execute(
                    """INSERT INTO track_kpis (id, track_id, name, name_ar, sort_order, created_at)
                       VALUES (%s, %s, %s, %s, %s, NOW())""",
                    (kid, track_id, kpi, kpi, idx),
                )
            if kpi_texts:
                print(f"    KPIs: {len(kpi_texts)}")

        # Penalties (col 12)
        if ncols >= 13:
            pen_texts = set()
            for _, row in df.iloc[1:].iterrows():
                pen = clean(row.iloc[12])
                if pen and pen not in pen_texts:
                    pen_texts.add(pen)

            for idx, pen in enumerate(pen_texts):
                pid = gen_cuid()
                cur.execute(
                    """INSERT INTO penalties (id, track_id, violation, violation_ar, sort_order, created_at)
                       VALUES (%s, %s, %s, %s, %s, NOW())""",
                    (pid, track_id, pen, pen, idx),
                )
            if pen_texts:
                print(f"    Penalties: {len(pen_texts)}")

        # Scope (col 13)
        if ncols >= 14:
            scope_texts = set()
            for _, row in df.iloc[1:].iterrows():
                scope = clean(row.iloc[13])
                if scope and scope not in scope_texts:
                    scope_texts.add(scope)

            for idx, scope in enumerate(scope_texts):
                sid = gen_cuid()
                cur.execute(
                    """INSERT INTO scopes (id, track_id, title, title_ar, sort_order, created_at)
                       VALUES (%s, %s, %s, %s, %s, NOW())""",
                    (sid, track_id, scope, scope, idx),
                )
            if scope_texts:
                print(f"    Scopes: {len(scope_texts)}")

    conn.commit()

    # ─── 4. Import Cameras track ───
    print("\n4. Importing cameras track data...")
    if "مسار كاميرات النوارية" in raw:
        cam_df = raw["مسار كاميرات النوارية"]
        cam_track_id = track_ids.get("cameras_nawaria")
        if cam_track_id:
            # Deliverables from col 3
            for idx, (_, row) in enumerate(cam_df.iterrows()):
                name = clean(row.iloc[3]) if len(cam_df.columns) > 3 else None
                if not name:
                    continue
                indicators = clean(row.iloc[5]) if len(cam_df.columns) > 5 else None
                did = gen_cuid()
                cur.execute(
                    """INSERT INTO deliverables (id, track_id, name, name_ar, delivery_indicators, sort_order, created_at)
                       VALUES (%s, %s, %s, %s, %s, %s, NOW())""",
                    (did, cam_track_id, name, name, indicators, idx),
                )

            # KPI from last column
            last_col = cam_df.columns[-1]
            for _, row in cam_df.iterrows():
                kpi = clean(row[last_col])
                if kpi:
                    kid = gen_cuid()
                    cur.execute(
                        """INSERT INTO track_kpis (id, track_id, name, name_ar, sort_order, created_at)
                           VALUES (%s, %s, %s, %s, 0, NOW())""",
                        (kid, cam_track_id, kpi, kpi),
                    )
            print("  Cameras data imported")

    conn.commit()

    # ─── 5. Import Contracts (التوقيع حتى الان) ───
    print("\n5. Importing contracts...")
    ct = raw["التوقيع حتى الان"].copy()
    ct.columns = ["م", "الاسم", "المنصب", "المسار", "نوع العقد", "شهري", "الشهور", "الإجمالي"]
    ct = ct.dropna(subset=["الاسم"])

    contract_count = 0
    for _, row in ct.iterrows():
        name = clean(row["الاسم"])
        if not name:
            continue

        # Try to find matching employee
        cur.execute("SELECT id FROM employees WHERE full_name_ar = %s LIMIT 1", (name,))
        emp_row = cur.fetchone()
        emp_id = emp_row[0] if emp_row else None

        track_name = clean(row["المسار"]) or ""
        monthly = float(row["شهري"]) if pd.notna(row["شهري"]) else None
        months = float(row["الشهور"]) if pd.notna(row["الشهور"]) else None
        total = float(row["الإجمالي"]) if pd.notna(row["الإجمالي"]) else None

        cid = gen_cuid()
        cur.execute(
            """INSERT INTO contracts (id, employee_id, employee_name, position, track_name,
               contract_type, monthly_salary, months, total_value, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())""",
            (
                cid, emp_id, name, clean(row["المنصب"]),
                track_name, clean(row["نوع العقد"]),
                monthly, months, total,
            ),
        )
        contract_count += 1

    print(f"  Imported {contract_count} contracts")
    conn.commit()

    # ─── 6. Import Financial Costs (التكاليف المالية) ───
    print("\n6. Importing financial costs...")
    costs = raw["التكاليف المالية للموارد البشري"].copy()
    costs.columns = ["#", "المسار", "البنود", "المهام", "النوع", "المدة", "الكمية"]
    costs["المسار"] = costs["المسار"].ffill()

    cost_count = 0
    for _, row in costs.iterrows():
        item = clean(row["البنود"])
        if not item:
            continue

        months_val = float(row["المدة"]) if pd.notna(row["المدة"]) else None
        qty = float(row["الكمية"]) if pd.notna(row["الكمية"]) else None
        track = clean(row["المسار"]) or ""

        fid = gen_cuid()
        cur.execute(
            """INSERT INTO financial_costs (id, track_name, item_detail, tasks, type, months, quantity, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())""",
            (fid, track, item, clean(row["المهام"]), clean(row["النوع"]), months_val, qty),
        )
        cost_count += 1

    print(f"  Imported {cost_count} financial cost items")
    conn.commit()

    # ─── Summary ───
    print("\n" + "-" * 60)
    print("  Import Summary:")

    tables = ["tracks", "employees", "contracts", "deliverables", "track_kpis", "penalties", "scopes", "financial_costs", "records"]
    for t in tables:
        cur.execute(f"SELECT COUNT(*) FROM {t}")
        count = cur.fetchone()[0]
        print(f"    {t:20s}: {count}")

    print("-" * 60)
    print("  Import completed successfully!")
    print("=" * 60 + "\n")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
