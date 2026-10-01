from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import csv
import re
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---------- Config ----------
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "Kacc@8131"


# ---------- Models ----------
class StudentCreate(BaseModel):
    admission_no: str
    full_name: str
    date_of_birth: str
    father_name: str
    type: Literal["Free-Style", "Workshop"]
    address: str
    student_class: str
    phone_no: str
    whatsapp_no: str
    email: str
    photo_base64: Optional[str] = None  # data URI or base64


class Student(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    admission_no: str
    date_of_registration: str
    full_name: str
    date_of_birth: str
    father_name: str
    type: str
    address: str
    student_class: str
    phone_no: str
    whatsapp_no: str
    email: str
    photo_base64: Optional[str] = None
    approved: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class StudentUpdate(BaseModel):
    full_name: Optional[str] = None
    father_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    type: Optional[Literal["Free-Style", "Workshop"]] = None
    address: Optional[str] = None
    student_class: Optional[str] = None
    phone_no: Optional[str] = None
    whatsapp_no: Optional[str] = None
    email: Optional[str] = None


class AdminLogin(BaseModel):
    username: str
    password: str


class AdmissionListAdd(BaseModel):
    admission_nos: List[str]


class AdmissionEntry(BaseModel):
    admission_no: str
    created_at: str


def normalize_admission(value: str) -> str:
    return value.strip().upper()


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Taal Tarang Garba API"}


@api_router.post("/students/register", response_model=Student)
async def register_student(payload: StudentCreate):
    admission_no = normalize_admission(payload.admission_no)
    if not admission_no:
        raise HTTPException(status_code=400, detail="Admission number is required")

    allowed = await db.allowed_admissions.find_one({"admission_no": admission_no}, {"_id": 0})
    if not allowed:
        raise HTTPException(
            status_code=403,
            detail="Admission number not found in college list. Please contact the admin.",
        )

    existing = await db.students.find_one({"admission_no": admission_no}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Admission number already registered")

    student = Student(
        admission_no=admission_no,
        approved=True,
        date_of_registration=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        full_name=payload.full_name,
        date_of_birth=payload.date_of_birth,
        father_name=payload.father_name,
        type=payload.type,
        address=payload.address,
        student_class=payload.student_class,
        phone_no=payload.phone_no,
        whatsapp_no=payload.whatsapp_no,
        email=payload.email,
        photo_base64=payload.photo_base64,
    )
    doc = student.model_dump()
    await db.students.insert_one(doc)
    return student


@api_router.get("/students/{student_id}", response_model=Student)
async def get_student(student_id: str):
    student = await db.students.find_one({"id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Registration not found")
    return Student(**student)


@api_router.post("/admin/login")
async def admin_login(payload: AdminLogin):
    username = payload.username.strip().lower()
    password = payload.password.strip()
    if username != ADMIN_USERNAME or password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    return {"token": "admin-session-token", "username": ADMIN_USERNAME}


@api_router.get("/admin/admissions", response_model=List[AdmissionEntry])
async def admin_list_admissions():
    rows = await db.allowed_admissions.find({}, {"_id": 0}).sort("admission_no", 1).to_list(5000)
    return [AdmissionEntry(**r) for r in rows]


@api_router.post("/admin/admissions")
async def admin_add_admissions(payload: AdmissionListAdd):
    cleaned = []
    seen = set()
    for raw in payload.admission_nos:
        value = normalize_admission(raw)
        if value and value not in seen:
            seen.add(value)
            cleaned.append(value)
    if not cleaned:
        raise HTTPException(status_code=400, detail="No valid admission numbers provided")

    existing_rows = await db.allowed_admissions.find(
        {"admission_no": {"$in": cleaned}}, {"_id": 0, "admission_no": 1}
    ).to_list(5000)
    existing = {r["admission_no"] for r in existing_rows}
    new_values = [v for v in cleaned if v not in existing]
    if new_values:
        now = datetime.now(timezone.utc).isoformat()
        await db.allowed_admissions.insert_many(
            [{"admission_no": v, "created_at": now} for v in new_values]
        )
    return {"added": len(new_values), "skipped": len(cleaned) - len(new_values)}


@api_router.delete("/admin/admissions/{admission_no}")
async def admin_delete_admission(admission_no: str):
    result = await db.allowed_admissions.delete_one({"admission_no": normalize_admission(admission_no)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Admission number not found")
    return {"message": "Admission number removed"}


@api_router.get("/admin/students", response_model=List[Student])
async def admin_list_students():
    students = await db.students.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Student(**s) for s in students]


@api_router.get("/admin/students/export.csv")
async def admin_export_students_csv(type: Optional[str] = None):
    query = {"type": type} if type in ("Free-Style", "Workshop") else {}
    students = await db.students.find(query, {"_id": 0, "photo_base64": 0}).sort("full_name", 1).to_list(5000)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "S.No", "Admission No", "Full Name", "Father Name", "Date of Birth", "Class", "Type",
        "Phone", "WhatsApp", "Email", "Address", "Registration Date", "Signature",
    ])
    for i, s in enumerate(students, start=1):
        writer.writerow([
            i, s["admission_no"], s["full_name"], s["father_name"], s["date_of_birth"],
            s["student_class"], s["type"], s["phone_no"], s["whatsapp_no"], s["email"],
            s["address"], s["date_of_registration"], "",
        ])

    suffix = f"-{type.lower()}" if type in ("Free-Style", "Workshop") else ""
    filename = f"taal-tarang-students{suffix}-{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    return Response(
        content="\ufeff" + buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.patch("/admin/students/{student_id}", response_model=Student)
async def admin_update_student(student_id: str, payload: StudentUpdate):
    updates = {k: (v.strip() if isinstance(v, str) else v) for k, v in payload.model_dump(exclude_none=True).items()}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    for key in ("full_name", "father_name", "date_of_birth", "address", "student_class", "email"):
        if key in updates and not updates[key]:
            raise HTTPException(status_code=400, detail=f"{key.replace('_', ' ').title()} cannot be empty")
    for key in ("phone_no", "whatsapp_no"):
        if key in updates and not re.fullmatch(r"\d{10}", updates[key]):
            raise HTTPException(status_code=400, detail=f"{'Phone' if key == 'phone_no' else 'WhatsApp'} must be 10 digits")
    if "email" in updates and not re.fullmatch(r"\S+@\S+\.\S+", updates["email"]):
        raise HTTPException(status_code=400, detail="Valid email required")

    result = await db.students.find_one_and_update(
        {"id": student_id},
        {"$set": updates},
        return_document=True,
        projection={"_id": 0},
    )
    if not result:
        raise HTTPException(status_code=404, detail="Student not found")
    return Student(**result)


@api_router.delete("/admin/students/{student_id}")
async def admin_delete_student(student_id: str):
    result = await db.students.delete_one({"id": student_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    return {"message": "Student deleted"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
