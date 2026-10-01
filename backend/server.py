from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
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
ADMIN_PASSWORD = "admin123"
MOCK_OTP = "123456"


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


class AdminLogin(BaseModel):
    username: str
    password: str


class OTPRequest(BaseModel):
    phone_no: str


class OTPVerify(BaseModel):
    phone_no: str
    otp: str


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Taal Tarang Garba API"}


@api_router.post("/students/register", response_model=Student)
async def register_student(payload: StudentCreate):
    # Prevent duplicate admission numbers
    existing = await db.students.find_one({"admission_no": payload.admission_no}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Admission number already registered")

    student = Student(
        admission_no=payload.admission_no,
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


@api_router.post("/students/send-otp")
async def send_otp(payload: OTPRequest):
    # Mock: always returns success. OTP is 123456
    student = await db.students.find_one({"phone_no": payload.phone_no}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="No registration found for this mobile number")
    return {"message": "OTP sent successfully", "mock_otp_hint": "Use 123456 for demo"}


@api_router.post("/students/verify-otp", response_model=Student)
async def verify_otp(payload: OTPVerify):
    if payload.otp != MOCK_OTP:
        raise HTTPException(status_code=401, detail="Invalid OTP")
    student = await db.students.find_one({"phone_no": payload.phone_no}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="No registration found for this mobile number")
    return Student(**student)


@api_router.post("/admin/login")
async def admin_login(payload: AdminLogin):
    if payload.username != ADMIN_USERNAME or payload.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    return {"token": "admin-session-token", "username": ADMIN_USERNAME}


@api_router.get("/admin/students", response_model=List[Student])
async def admin_list_students():
    students = await db.students.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Student(**s) for s in students]


@api_router.post("/admin/students/{student_id}/approve", response_model=Student)
async def admin_approve_student(student_id: str):
    result = await db.students.find_one_and_update(
        {"id": student_id},
        {"$set": {"approved": True}},
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
