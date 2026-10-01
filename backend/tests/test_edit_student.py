"""Tests for PATCH /api/admin/students/{id} - Edit Student feature."""
import os
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADM = "TEST_EDIT_001"
SEED = {
    "admission_no": ADM,
    "full_name": "Edit Test User",
    "date_of_birth": "01/01/2000",
    "father_name": "Edit Father",
    "type": "Free-Style",
    "address": "Edit Address 1",
    "student_class": "FY-A",
    "phone_no": "9999999999",
    "whatsapp_no": "9999999998",
    "email": "edit.test@example.com",
}


@pytest.fixture(scope="module")
def seeded_student():
    # Ensure clean state
    requests.post(f"{API}/admin/admissions", json={"admission_nos": [ADM]})
    # If previous student exists, delete via admin list
    stus = requests.get(f"{API}/admin/students").json()
    for s in stus:
        if s["admission_no"] == ADM:
            requests.delete(f"{API}/admin/students/{s['id']}")
    r = requests.post(f"{API}/students/register", json=SEED)
    assert r.status_code == 200, r.text
    student = r.json()
    yield student
    # Teardown
    requests.delete(f"{API}/admin/students/{student['id']}")
    requests.delete(f"{API}/admin/admissions/{ADM}")


def test_partial_update_persists(seeded_student):
    sid = seeded_student["id"]
    r = requests.patch(f"{API}/admin/students/{sid}", json={
        "full_name": "  Edited Name  ",
        "student_class": "SY-B",
        "phone_no": "8888888888",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["full_name"] == "Edited Name"  # trimmed
    assert body["student_class"] == "SY-B"
    assert body["phone_no"] == "8888888888"
    # Unchanged fields
    assert body["father_name"] == SEED["father_name"]
    assert body["email"] == SEED["email"]
    assert body["admission_no"] == ADM
    assert body["id"] == sid

    # GET reflects update
    g = requests.get(f"{API}/students/{sid}")
    assert g.status_code == 200
    assert g.json()["full_name"] == "Edited Name"
    assert g.json()["student_class"] == "SY-B"


def test_update_type_switch(seeded_student):
    sid = seeded_student["id"]
    r = requests.patch(f"{API}/admin/students/{sid}", json={"type": "Workshop"})
    assert r.status_code == 200
    assert r.json()["type"] == "Workshop"
    # revert
    requests.patch(f"{API}/admin/students/{sid}", json={"type": "Free-Style"})


def test_extra_fields_ignored(seeded_student):
    sid = seeded_student["id"]
    r = requests.patch(f"{API}/admin/students/{sid}", json={
        "full_name": "Still Edited",
        "admission_no": "HACK-999",
        "id": "hack-id",
        "approved": False,
    })
    assert r.status_code == 200
    body = r.json()
    assert body["admission_no"] == ADM
    assert body["id"] == sid
    assert body["approved"] is True


def test_empty_body_400(seeded_student):
    sid = seeded_student["id"]
    r = requests.patch(f"{API}/admin/students/{sid}", json={})
    assert r.status_code == 400
    assert "No fields to update" in r.json()["detail"]


def test_phone_invalid_400(seeded_student):
    sid = seeded_student["id"]
    r = requests.patch(f"{API}/admin/students/{sid}", json={"phone_no": "123"})
    assert r.status_code == 400
    assert "Phone must be 10 digits" in r.json()["detail"]


def test_whatsapp_invalid_400(seeded_student):
    sid = seeded_student["id"]
    r = requests.patch(f"{API}/admin/students/{sid}", json={"whatsapp_no": "abc"})
    assert r.status_code == 400
    assert "WhatsApp must be 10 digits" in r.json()["detail"]


def test_email_invalid_400(seeded_student):
    sid = seeded_student["id"]
    r = requests.patch(f"{API}/admin/students/{sid}", json={"email": "bad"})
    assert r.status_code == 400
    assert "Valid email required" in r.json()["detail"]


def test_full_name_empty_400(seeded_student):
    sid = seeded_student["id"]
    r = requests.patch(f"{API}/admin/students/{sid}", json={"full_name": "   "})
    assert r.status_code == 400
    assert "cannot be empty" in r.json()["detail"].lower()


def test_type_invalid_422(seeded_student):
    sid = seeded_student["id"]
    r = requests.patch(f"{API}/admin/students/{sid}", json={"type": "Other"})
    assert r.status_code == 422


def test_unknown_id_404():
    r = requests.patch(f"{API}/admin/students/nonexistent-id-xyz", json={"full_name": "X"})
    assert r.status_code == 404
