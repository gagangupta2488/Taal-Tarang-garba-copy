"""Backend tests for Taal Tarang Garba (admission list + registration + admin)"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    # Load from frontend/.env if not in env
    from pathlib import Path
    env_file = Path("/app/frontend/.env")
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
                break

BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    yield s


# unique markers per test run so we don't collide with other data
MARK = uuid.uuid4().hex[:6].upper()
ADM1 = f"TST{MARK}1"
ADM2 = f"TST{MARK}2"
ADM3 = f"TST{MARK}3"
ADM_LOWER = ADM1.lower()  # for case-insensitive registration check


# ---------- Admin login ----------
class TestAdminLogin:
    def test_login_success_new_password(self, session):
        r = session.post(f"{API}/admin/login", json={"username": "admin", "password": "Kacc@8131"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("username") == "admin"
        assert "token" in data

    def test_login_old_password_rejected(self, session):
        r = session.post(f"{API}/admin/login", json={"username": "admin", "password": "admin123"})
        assert r.status_code == 401

    def test_login_wrong_user_rejected(self, session):
        r = session.post(f"{API}/admin/login", json={"username": "root", "password": "Kacc@8131"})
        assert r.status_code == 401


# ---------- Admission list CRUD ----------
class TestAdmissionList:
    def test_add_bulk_with_dedupe_and_normalize(self, session):
        # Add 3 unique + duplicate + whitespace; expect added=3, skipped=1
        r = session.post(f"{API}/admin/admissions", json={
            "admission_nos": [f"  {ADM1.lower()}  ", ADM2, ADM3, ADM1]
        })
        assert r.status_code == 200, r.text
        data = r.json()
        # ADM1 lowercase + ADM1 upper collapse via normalize -> seen set makes cleaned=[ADM1,ADM2,ADM3]
        assert data["added"] == 3
        assert data["skipped"] == 0

    def test_add_duplicates_skipped(self, session):
        r = session.post(f"{API}/admin/admissions", json={"admission_nos": [ADM1, ADM2]})
        assert r.status_code == 200
        data = r.json()
        assert data["added"] == 0
        assert data["skipped"] == 2

    def test_list_contains_added(self, session):
        r = session.get(f"{API}/admin/admissions")
        assert r.status_code == 200
        nos = [row["admission_no"] for row in r.json()]
        for a in (ADM1, ADM2, ADM3):
            assert a in nos, f"{a} missing in list"

    def test_add_empty_rejected(self, session):
        r = session.post(f"{API}/admin/admissions", json={"admission_nos": ["   ", ""]})
        assert r.status_code == 400

    def test_delete_admission_404_missing(self, session):
        r = session.delete(f"{API}/admin/admissions/DOES_NOT_EXIST_{MARK}")
        assert r.status_code == 404

    def test_delete_admission_ok(self, session):
        r = session.delete(f"{API}/admin/admissions/{ADM3}")
        assert r.status_code == 200
        # Verify gone
        r2 = session.get(f"{API}/admin/admissions")
        nos = [row["admission_no"] for row in r2.json()]
        assert ADM3 not in nos


# ---------- Student registration ----------
STUDENT_PAYLOAD = {
    "admission_no": ADM1,
    "full_name": f"Test Student {MARK}",
    "date_of_birth": "01/01/2004",
    "father_name": "Test Father",
    "type": "Free-Style",
    "address": "Test Address",
    "student_class": "BA-II",
    "phone_no": "9000000001",
    "whatsapp_no": "9000000002",
    "email": "test@example.com",
    "photo_base64": None,
}

created_student_id = {}


class TestStudentRegistration:
    def test_register_not_in_list_403(self, session):
        payload = {**STUDENT_PAYLOAD, "admission_no": f"NOPE_{MARK}"}
        r = session.post(f"{API}/students/register", json=payload)
        assert r.status_code == 403, r.text
        assert "admin" in r.json().get("detail", "").lower() or "not found" in r.json().get("detail", "").lower()

    def test_register_case_insensitive_match_succeeds(self, session):
        # Register using lowercase form, backend normalizes to uppercase match in list
        payload = {**STUDENT_PAYLOAD, "admission_no": ADM_LOWER}
        r = session.post(f"{API}/students/register", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["admission_no"] == ADM1  # normalized
        assert data["approved"] is True
        assert "id" in data
        created_student_id["id"] = data["id"]

    def test_register_duplicate_400(self, session):
        r = session.post(f"{API}/students/register", json=STUDENT_PAYLOAD)
        assert r.status_code == 400
        assert "already" in r.json().get("detail", "").lower()

    def test_get_student_by_id(self, session):
        sid = created_student_id.get("id")
        assert sid, "previous test must have created student"
        r = session.get(f"{API}/students/{sid}")
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == sid
        assert data["admission_no"] == ADM1

    def test_get_student_404(self, session):
        r = session.get(f"{API}/students/nonexistent-{MARK}")
        assert r.status_code == 404


# ---------- Admin students list & delete ----------
class TestAdminStudents:
    def test_list_students_contains_created(self, session):
        r = session.get(f"{API}/admin/students")
        assert r.status_code == 200
        ids = [s["id"] for s in r.json()]
        assert created_student_id["id"] in ids

    def test_delete_student(self, session):
        sid = created_student_id["id"]
        r = session.delete(f"{API}/admin/students/{sid}")
        assert r.status_code == 200
        # Verify 404 on GET
        r2 = session.get(f"{API}/students/{sid}")
        assert r2.status_code == 404

    def test_delete_student_404(self, session):
        r = session.delete(f"{API}/admin/students/does-not-exist-{MARK}")
        assert r.status_code == 404


# ---------- Removed endpoints (OTP/approve) ----------
class TestRemovedEndpoints:
    def test_approve_endpoint_gone(self, session):
        r = session.post(f"{API}/admin/students/fake-id/approve", json={})
        assert r.status_code in (404, 405), f"status={r.status_code}"

    def test_send_otp_gone(self, session):
        r = session.post(f"{API}/students/send-otp", json={"phone_no": "9000000000"})
        assert r.status_code in (404, 405)

    def test_verify_otp_gone(self, session):
        r = session.post(f"{API}/students/verify-otp", json={"phone_no": "9000000000", "otp": "123456"})
        assert r.status_code in (404, 405)


# ---------- Cleanup ----------
def teardown_module(module):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    for adm in (ADM1, ADM2, ADM3):
        try:
            s.delete(f"{API}/admin/admissions/{adm}")
        except Exception:
            pass
    # Clean up any student leftover
    try:
        sid = created_student_id.get("id")
        if sid:
            s.delete(f"{API}/admin/students/{sid}")
    except Exception:
        pass
