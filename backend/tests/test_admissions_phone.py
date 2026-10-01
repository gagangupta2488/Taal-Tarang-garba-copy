"""Tests for the new/updated endpoints:
- GET /api/admissions/check (admission_no normalization + allowed/registered flags)
- GET /api/students/by-phone/{phone} (phone normalization + 404/400 rules)
Also covers full register-flow regression + cleanup.
"""
import os
import re
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get("EXPO_PUBLIC_BACKEND_URL") else None
if not BASE_URL:
    # fallback to frontend .env read if env not injected
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                break

API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# a unique admission suffix per test module run so repeated runs don't collide
RUN_TAG = uuid.uuid4().hex[:4].upper()
TEST_ADMISSION = f"TEST{RUN_TAG}1"           # seeded, unregistered
TEST_ADMISSION_REG = f"TEST{RUN_TAG}2"       # seeded + registered
TEST_PHONE = "9" + str(1000000000 + int(RUN_TAG, 16) % 900000000)[-9:]  # 10-digit
TEST_WHATSAPP = "8" + TEST_PHONE[1:]


@pytest.fixture(scope="module", autouse=True)
def seed_and_cleanup(session):
    # Seed two admission numbers
    r = session.post(f"{API}/admin/admissions", json={"admission_nos": [TEST_ADMISSION, TEST_ADMISSION_REG]})
    assert r.status_code == 200, r.text

    # Register a student against the second one so we can test by-phone + registered=true
    reg_payload = {
        "admission_no": TEST_ADMISSION_REG,
        "full_name": "TEST Student Lookup",
        "date_of_birth": "01/01/2004",
        "father_name": "TEST Father",
        "type": "Free-Style",
        "address": "TEST Addr",
        "student_class": "BA-II",
        "phone_no": TEST_PHONE,
        "whatsapp_no": TEST_WHATSAPP,
        "email": f"test{RUN_TAG}@example.com",
        "photo_base64": None,
    }
    r = session.post(f"{API}/students/register", json=reg_payload)
    assert r.status_code == 200, r.text
    student_id = r.json()["id"]
    yield {"student_id": student_id}

    # Cleanup: delete student + both admission numbers
    session.delete(f"{API}/admin/students/{student_id}")
    session.delete(f"{API}/admin/admissions/{TEST_ADMISSION}")
    session.delete(f"{API}/admin/admissions/{TEST_ADMISSION_REG}")


# ---------- GET /api/admissions/check ----------
class TestAdmissionsCheck:
    def test_unknown_admission_returns_allowed_false(self, session):
        r = session.get(f"{API}/admissions/check", params={"admission_no": f"NOPE{RUN_TAG}999"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["allowed"] is False
        assert data["registered"] is False

    def test_in_list_but_not_registered(self, session):
        r = session.get(f"{API}/admissions/check", params={"admission_no": TEST_ADMISSION})
        assert r.status_code == 200
        data = r.json()
        assert data["allowed"] is True
        assert data["registered"] is False
        assert data["admission_no"] == TEST_ADMISSION  # normalized upper

    def test_in_list_and_registered(self, session):
        r = session.get(f"{API}/admissions/check", params={"admission_no": TEST_ADMISSION_REG})
        assert r.status_code == 200
        data = r.json()
        assert data["allowed"] is True
        assert data["registered"] is True

    def test_normalization_lowercase_and_whitespace(self, session):
        # pass lowercase + leading/trailing whitespace
        r = session.get(f"{API}/admissions/check", params={"admission_no": f"  {TEST_ADMISSION.lower()}  "})
        assert r.status_code == 200
        data = r.json()
        assert data["admission_no"] == TEST_ADMISSION
        assert data["allowed"] is True

    def test_empty_admission_returns_400(self, session):
        # whitespace-only should normalize to empty => 400
        r = session.get(f"{API}/admissions/check", params={"admission_no": "   "})
        assert r.status_code == 400


# ---------- GET /api/students/by-phone/{phone} ----------
class TestStudentByPhone:
    def test_known_phone(self, session):
        r = session.get(f"{API}/students/by-phone/{TEST_PHONE}")
        assert r.status_code == 200, r.text
        s = r.json()
        assert s["admission_no"] == TEST_ADMISSION_REG
        assert s["phone_no"] == TEST_PHONE

    def test_known_phone_via_whatsapp_field(self, session):
        r = session.get(f"{API}/students/by-phone/{TEST_WHATSAPP}")
        assert r.status_code == 200, r.text
        assert r.json()["whatsapp_no"] == TEST_WHATSAPP

    def test_phone_with_plus91_prefix(self, session):
        # "+91 <10digit>" -> strip non digits -> take last 10
        r = session.get(f"{API}/students/by-phone/{requests.utils.quote('+91 ' + TEST_PHONE)}")
        assert r.status_code == 200
        assert r.json()["phone_no"] == TEST_PHONE

    def test_phone_with_91_prefix_12_digits(self, session):
        r = session.get(f"{API}/students/by-phone/91{TEST_PHONE}")
        assert r.status_code == 200
        assert r.json()["phone_no"] == TEST_PHONE

    def test_unknown_phone_returns_404(self, session):
        r = session.get(f"{API}/students/by-phone/9999999999")
        assert r.status_code == 404
        assert "No registration found" in r.json().get("detail", "")

    def test_short_phone_returns_400(self, session):
        r = session.get(f"{API}/students/by-phone/12345")
        assert r.status_code == 400
        assert "10-digit" in r.json().get("detail", "")


# ---------- Full register flow regression ----------
class TestRegisterFlowRegression:
    """Register a brand-new student against a freshly-seeded admission no, then clean up."""

    def test_full_register_flow(self, session):
        tag = uuid.uuid4().hex[:4].upper()
        admission = f"REG{tag}"
        phone = "7" + str(1000000000 + int(tag, 16) % 900000000)[-9:]

        # seed
        r = session.post(f"{API}/admin/admissions", json={"admission_nos": [admission]})
        assert r.status_code == 200

        # register
        payload = {
            "admission_no": admission,
            "full_name": "TEST Regression User",
            "date_of_birth": "02/02/2003",
            "father_name": "TEST Father",
            "type": "Workshop",
            "address": "TEST Addr 2",
            "student_class": "12th",
            "phone_no": phone,
            "whatsapp_no": phone,
            "email": f"reg{tag}@example.com",
            "photo_base64": None,
        }
        r = session.post(f"{API}/students/register", json=payload)
        assert r.status_code == 200, r.text
        s = r.json()
        assert s["admission_no"] == admission
        assert s["approved"] is True
        sid = s["id"]

        # verify via by-phone
        r = session.get(f"{API}/students/by-phone/{phone}")
        assert r.status_code == 200
        assert r.json()["id"] == sid

        # verify via check endpoint
        r = session.get(f"{API}/admissions/check", params={"admission_no": admission})
        assert r.json()["registered"] is True

        # cleanup
        session.delete(f"{API}/admin/students/{sid}")
        session.delete(f"{API}/admin/admissions/{admission}")
