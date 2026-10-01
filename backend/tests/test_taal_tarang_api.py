"""Backend API tests for Taal Tarang Garba app."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://taal-tarang-garba.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def student_payload():
    uniq = uuid.uuid4().hex[:8]
    return {
        "admission_no": f"TEST_{uniq}",
        "full_name": "TEST Student",
        "date_of_birth": "2005-01-15",
        "father_name": "TEST Father",
        "type": "Free-Style",
        "address": "123 Test Lane",
        "student_class": "12A",
        "phone_no": f"98{uuid.uuid4().int % 100000000:08d}",
        "whatsapp_no": "9893395454",
        "email": "test_student@example.com",
        "photo_base64": None,
    }


created = {}


# ---------- Health ----------
def test_root(session):
    r = session.get(f"{API}/")
    assert r.status_code == 200
    assert "message" in r.json()


# ---------- Student Registration ----------
def test_register_student(session, student_payload):
    r = session.post(f"{API}/students/register", json=student_payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["admission_no"] == student_payload["admission_no"]
    assert data["approved"] is False
    assert data["date_of_registration"]  # auto-filled
    assert "id" in data
    assert "_id" not in data
    created["id"] = data["id"]
    created["phone"] = student_payload["phone_no"]


def test_register_duplicate_admission(session, student_payload):
    r = session.post(f"{API}/students/register", json=student_payload)
    assert r.status_code == 400
    assert "already" in r.json()["detail"].lower()


# ---------- OTP ----------
def test_send_otp_unknown_phone(session):
    r = session.post(f"{API}/students/send-otp", json={"phone_no": "0000000000"})
    assert r.status_code == 404


def test_send_otp_known_phone(session):
    r = session.post(f"{API}/students/send-otp", json={"phone_no": created["phone"]})
    assert r.status_code == 200
    data = r.json()
    assert "mock_otp_hint" in data


def test_verify_otp_wrong(session):
    r = session.post(f"{API}/students/verify-otp", json={"phone_no": created["phone"], "otp": "000000"})
    assert r.status_code == 401


def test_verify_otp_correct(session):
    r = session.post(f"{API}/students/verify-otp", json={"phone_no": created["phone"], "otp": "123456"})
    assert r.status_code == 200
    data = r.json()
    assert data["phone_no"] == created["phone"]
    assert data["approved"] is False


# ---------- Admin ----------
def test_admin_login_wrong(session):
    r = session.post(f"{API}/admin/login", json={"username": "admin", "password": "wrong"})
    assert r.status_code == 401


def test_admin_login_ok(session):
    r = session.post(f"{API}/admin/login", json={"username": "admin", "password": "admin123"})
    assert r.status_code == 200
    assert r.json()["token"]


def test_admin_list_students(session):
    r = session.get(f"{API}/admin/students")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert any(s["id"] == created["id"] for s in data)
    for s in data:
        assert "_id" not in s


def test_admin_approve_student(session):
    r = session.post(f"{API}/admin/students/{created['id']}/approve")
    assert r.status_code == 200
    assert r.json()["approved"] is True

    # Verify persistence via verify-otp
    v = session.post(f"{API}/students/verify-otp", json={"phone_no": created["phone"], "otp": "123456"})
    assert v.status_code == 200
    assert v.json()["approved"] is True


def test_admin_approve_missing(session):
    r = session.post(f"{API}/admin/students/nonexistent-id/approve")
    assert r.status_code == 404


def test_admin_delete_student(session):
    r = session.delete(f"{API}/admin/students/{created['id']}")
    assert r.status_code == 200

    # Verify deletion
    v = session.post(f"{API}/students/verify-otp", json={"phone_no": created["phone"], "otp": "123456"})
    assert v.status_code == 404


def test_admin_delete_missing(session):
    r = session.delete(f"{API}/admin/students/nonexistent-id")
    assert r.status_code == 404
