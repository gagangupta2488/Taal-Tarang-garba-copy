"""Backend tests for new CSV export + type filter features"""
import os
import io
import csv
import uuid
import datetime as dt
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    from pathlib import Path
    env_file = Path("/app/frontend/.env")
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
                break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

MARK = uuid.uuid4().hex[:6].upper()
ADM_FREE = f"CSVF{MARK}"
ADM_WRK = f"CSVW{MARK}"

CREATED = {"students": [], "admissions": [ADM_FREE, ADM_WRK]}


@pytest.fixture(scope="module", autouse=True)
def seed_data():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    # Seed allowed admissions
    r = s.post(f"{API}/admin/admissions", json={"admission_nos": [ADM_FREE, ADM_WRK]})
    assert r.status_code == 200, r.text

    # Register Free-Style
    r1 = s.post(f"{API}/students/register", json={
        "admission_no": ADM_FREE,
        "full_name": f"Aaron CSV Free {MARK}",
        "date_of_birth": "01/01/2004",
        "father_name": "F Free",
        "type": "Free-Style",
        "address": "Addr Free",
        "student_class": "BA-II",
        "phone_no": "9000000011",
        "whatsapp_no": "9000000012",
        "email": "free@example.com",
        "photo_base64": None,
    })
    assert r1.status_code == 200, r1.text
    CREATED["students"].append(r1.json()["id"])

    # Register Workshop
    r2 = s.post(f"{API}/students/register", json={
        "admission_no": ADM_WRK,
        "full_name": f"Zara CSV Workshop {MARK}",
        "date_of_birth": "02/02/2004",
        "father_name": "F Wrk",
        "type": "Workshop",
        "address": "Addr Wrk",
        "student_class": "BA-III",
        "phone_no": "9000000021",
        "whatsapp_no": "9000000022",
        "email": "wrk@example.com",
        "photo_base64": None,
    })
    assert r2.status_code == 200, r2.text
    CREATED["students"].append(r2.json()["id"])

    yield

    # teardown
    for sid in CREATED["students"]:
        try:
            s.delete(f"{API}/admin/students/{sid}")
        except Exception:
            pass
    for adm in CREATED["admissions"]:
        try:
            s.delete(f"{API}/admin/admissions/{adm}")
        except Exception:
            pass


@pytest.fixture
def api_client():
    s = requests.Session()
    yield s


EXPECTED_HEADER = [
    "S.No", "Admission No", "Full Name", "Father Name", "Date of Birth", "Class", "Type",
    "Phone", "WhatsApp", "Email", "Address", "Registration Date", "Signature",
]


def _parse_csv(text):
    # Strip BOM
    assert text.startswith("\ufeff"), "CSV must start with UTF-8 BOM"
    text = text.lstrip("\ufeff")
    reader = csv.reader(io.StringIO(text))
    return list(reader)


class TestExportCsv:
    def test_export_all_status_and_headers(self, api_client):
        r = api_client.get(f"{API}/admin/students/export.csv")
        assert r.status_code == 200, r.text
        ct = r.headers.get("content-type", "")
        assert "text/csv" in ct, f"content-type={ct}"
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd.lower()
        today = dt.datetime.utcnow().strftime("%Y%m%d")
        assert f"taal-tarang-students-{today}.csv" in cd, f"content-disposition={cd}"

    def test_export_all_body_format(self, api_client):
        r = api_client.get(f"{API}/admin/students/export.csv")
        rows = _parse_csv(r.text)
        assert rows[0] == EXPECTED_HEADER, f"header mismatch: {rows[0]}"
        # ensure no photo_base64 column
        assert "photo_base64" not in [c.lower() for c in rows[0]]
        # S.No sequential
        for i, row in enumerate(rows[1:], start=1):
            assert row[0] == str(i), f"S.No at row {i} = {row[0]}"
            # Signature blank
            assert row[12] == "", f"Signature not blank: {row[12]!r}"
        # sorted by full_name
        names = [r[2] for r in rows[1:]]
        assert names == sorted(names), f"names not sorted: {names}"

    def test_export_count_matches_admin_students(self, api_client):
        csv_rows = _parse_csv(api_client.get(f"{API}/admin/students/export.csv").text)
        csv_count = len(csv_rows) - 1
        r = api_client.get(f"{API}/admin/students")
        assert r.status_code == 200
        api_count = len(r.json())
        assert csv_count == api_count, f"csv={csv_count} api={api_count}"

    def test_export_workshop_filter(self, api_client):
        r = api_client.get(f"{API}/admin/students/export.csv?type=Workshop")
        assert r.status_code == 200
        cd = r.headers.get("content-disposition", "")
        assert "-workshop-" in cd, f"filename missing -workshop-: {cd}"
        rows = _parse_csv(r.text)
        assert rows[0] == EXPECTED_HEADER
        for row in rows[1:]:
            assert row[6] == "Workshop", f"non-workshop row: {row}"

    def test_export_free_style_filter(self, api_client):
        r = api_client.get(f"{API}/admin/students/export.csv?type=Free-Style")
        assert r.status_code == 200
        cd = r.headers.get("content-disposition", "")
        assert "-free-style-" in cd, f"filename missing -free-style-: {cd}"
        rows = _parse_csv(r.text)
        for row in rows[1:]:
            assert row[6] == "Free-Style", f"non-free-style row: {row}"

    def test_export_invalid_type_ignored(self, api_client):
        r_all = api_client.get(f"{API}/admin/students/export.csv")
        r_bad = api_client.get(f"{API}/admin/students/export.csv?type=garbage")
        assert r_bad.status_code == 200
        cd = r_bad.headers.get("content-disposition", "")
        # Should fall back to default filename (no -workshop/-free-style suffix)
        assert "-workshop-" not in cd and "-free-style-" not in cd
        assert len(_parse_csv(r_bad.text)) == len(_parse_csv(r_all.text))

    def test_seed_students_present(self, api_client):
        """Verify both seeded students appear & filter counts work"""
        r_all = api_client.get(f"{API}/admin/students/export.csv")
        rows_all = _parse_csv(r_all.text)
        admissions = [r[1] for r in rows_all[1:]]
        assert ADM_FREE in admissions
        assert ADM_WRK in admissions

        r_wrk = api_client.get(f"{API}/admin/students/export.csv?type=Workshop")
        wrk_adms = [r[1] for r in _parse_csv(r_wrk.text)[1:]]
        assert ADM_WRK in wrk_adms
        assert ADM_FREE not in wrk_adms

        r_free = api_client.get(f"{API}/admin/students/export.csv?type=Free-Style")
        free_adms = [r[1] for r in _parse_csv(r_free.text)[1:]]
        assert ADM_FREE in free_adms
        assert ADM_WRK not in free_adms
