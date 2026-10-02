import type { Config } from "@netlify/functions";
import { createHmac, timingSafeEqual } from "node:crypto";
import { asc, desc, eq, getTableColumns, inArray, or } from "drizzle-orm";
import { db } from "../../db/index.js";
import { allowedAdmissions, students } from "../../db/schema.js";

// ---------- Config ----------
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Kacc@8131";
const TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || `taal-tarang:${ADMIN_PASSWORD}`;
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

const STUDENT_TYPES = ["Free-Style", "Workshop"] as const;
type StudentType = (typeof STUDENT_TYPES)[number];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: CORS_HEADERS });

const normalizeAdmission = (value: unknown) => (typeof value === "string" ? value.trim().toUpperCase() : "");

const isStudentType = (value: unknown): value is StudentType =>
  typeof value === "string" && (STUDENT_TYPES as readonly string[]).includes(value);

async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new HttpError(400, "Invalid request body");
}

// ---------- Admin auth ----------
function sign(payload: string) {
  return createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function issueToken() {
  const exp = String(Date.now() + TOKEN_TTL_MS);
  return `${exp}.${sign(exp)}`;
}

function requireAdmin(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !safeEqual(sig, sign(exp)) || Number(exp) < Date.now()) {
    throw new HttpError(401, "Admin session expired. Please log in again.");
  }
}

// ---------- Handlers ----------
async function registerStudent(req: Request) {
  const body = await readJson(req);
  const admission_no = normalizeAdmission(body.admission_no);
  if (!admission_no) throw new HttpError(400, "Admission number is required");

  const textFields = [
    "full_name", "date_of_birth", "father_name", "address", "student_class", "phone_no", "whatsapp_no", "email",
  ] as const;
  for (const key of textFields) {
    if (typeof body[key] !== "string") throw new HttpError(400, `${key.replace(/_/g, " ")} is required`);
  }
  if (!isStudentType(body.type)) throw new HttpError(400, "Type must be Free-Style or Workshop");
  const photo = typeof body.photo_base64 === "string" ? body.photo_base64 : null;

  const [allowed] = await db.select().from(allowedAdmissions).where(eq(allowedAdmissions.admission_no, admission_no));
  if (!allowed) {
    throw new HttpError(403, "Admission number not found in college list. Please contact the admin.");
  }

  const [inserted] = await db
    .insert(students)
    .values({
      id: crypto.randomUUID(),
      admission_no,
      approved: true,
      date_of_registration: new Date().toISOString().slice(0, 10),
      full_name: body.full_name as string,
      date_of_birth: body.date_of_birth as string,
      father_name: body.father_name as string,
      type: body.type,
      address: body.address as string,
      student_class: body.student_class as string,
      phone_no: body.phone_no as string,
      whatsapp_no: body.whatsapp_no as string,
      email: body.email as string,
      photo_base64: photo,
    })
    .onConflictDoNothing({ target: students.admission_no })
    .returning();
  if (!inserted) throw new HttpError(400, "Admission number already registered");
  return json(inserted);
}

async function checkAdmission(url: URL) {
  const value = normalizeAdmission(url.searchParams.get("admission_no"));
  if (!value) throw new HttpError(400, "Admission number is required");
  const [allowed] = await db.select().from(allowedAdmissions).where(eq(allowedAdmissions.admission_no, value));
  const [registered] = await db
    .select({ id: students.id })
    .from(students)
    .where(eq(students.admission_no, value));
  return json({ admission_no: value, allowed: Boolean(allowed), registered: Boolean(registered) });
}

async function getStudentByPhone(raw: string) {
  const phone = raw.replace(/\D/g, "").slice(-10);
  if (phone.length !== 10) throw new HttpError(400, "Enter a valid 10-digit mobile number");
  const [student] = await db
    .select()
    .from(students)
    .where(or(eq(students.phone_no, phone), eq(students.whatsapp_no, phone)))
    .limit(1);
  if (!student) throw new HttpError(404, "No registration found for this mobile number");
  return json(student);
}

async function getStudent(id: string) {
  const [student] = await db.select().from(students).where(eq(students.id, id));
  if (!student) throw new HttpError(404, "Registration not found");
  return json(student);
}

async function adminLogin(req: Request) {
  const body = await readJson(req);
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password.trim() : "";
  if (!safeEqual(username, ADMIN_USERNAME) || !safeEqual(password, ADMIN_PASSWORD)) {
    throw new HttpError(401, "Invalid admin credentials");
  }
  return json({ token: issueToken(), username: ADMIN_USERNAME });
}

async function adminListAdmissions() {
  const rows = await db.select().from(allowedAdmissions).orderBy(asc(allowedAdmissions.admission_no));
  return json(rows);
}

async function adminAddAdmissions(req: Request) {
  const body = await readJson(req);
  const raw = Array.isArray(body.admission_nos) ? body.admission_nos : [];
  const cleaned = [...new Set(raw.map(normalizeAdmission).filter(Boolean))];
  if (cleaned.length === 0) throw new HttpError(400, "No valid admission numbers provided");

  const added = await db
    .insert(allowedAdmissions)
    .values(cleaned.map((admission_no) => ({ admission_no })))
    .onConflictDoNothing()
    .returning({ admission_no: allowedAdmissions.admission_no });
  return json({ added: added.length, skipped: cleaned.length - added.length });
}

async function adminDeleteAdmission(raw: string) {
  const deleted = await db
    .delete(allowedAdmissions)
    .where(eq(allowedAdmissions.admission_no, normalizeAdmission(raw)))
    .returning({ admission_no: allowedAdmissions.admission_no });
  if (deleted.length === 0) throw new HttpError(404, "Admission number not found");
  return json({ message: "Admission number removed" });
}

async function adminListStudents() {
  const rows = await db.select().from(students).orderBy(desc(students.created_at)).limit(1000);
  return json(rows);
}

function csvCell(value: unknown) {
  const s = value == null ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function adminExportCsv(url: URL) {
  const type = url.searchParams.get("type");
  const filterType = isStudentType(type) ? type : null;
  const { photo_base64: _photo, ...columns } = getTableColumns(students);
  const rows = await db
    .select(columns)
    .from(students)
    .where(filterType ? eq(students.type, filterType) : undefined)
    .orderBy(asc(students.full_name));

  const lines = [
    ["S.No", "Admission No", "Full Name", "Father Name", "Date of Birth", "Class", "Type",
      "Phone", "WhatsApp", "Email", "Address", "Registration Date", "Signature"],
    ...rows.map((s, i) => [
      i + 1, s.admission_no, s.full_name, s.father_name, s.date_of_birth, s.student_class, s.type,
      s.phone_no, s.whatsapp_no, s.email, s.address, s.date_of_registration, "",
    ]),
  ];
  const csv = lines.map((line) => line.map(csvCell).join(",")).join("\r\n") + "\r\n";

  const suffix = filterType ? `-${filterType.toLowerCase()}` : "";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return new Response("﻿" + csv, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="taal-tarang-students${suffix}-${date}.csv"`,
    },
  });
}

async function adminUpdateStudent(req: Request, id: string) {
  const body = await readJson(req);
  const editable = [
    "full_name", "father_name", "date_of_birth", "type", "address", "student_class", "phone_no", "whatsapp_no", "email",
  ] as const;
  const updates: Partial<Record<(typeof editable)[number], string>> = {};
  for (const key of editable) {
    const value = body[key];
    if (value == null) continue;
    if (typeof value !== "string") throw new HttpError(400, `Invalid value for ${key.replace(/_/g, " ")}`);
    updates[key] = value.trim();
  }
  if (Object.keys(updates).length === 0) throw new HttpError(400, "No fields to update");

  for (const key of ["full_name", "father_name", "date_of_birth", "address", "student_class", "email"] as const) {
    if (key in updates && !updates[key]) {
      const label = key.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
      throw new HttpError(400, `${label} cannot be empty`);
    }
  }
  if ("type" in updates && !isStudentType(updates.type)) throw new HttpError(400, "Type must be Free-Style or Workshop");
  for (const key of ["phone_no", "whatsapp_no"] as const) {
    if (key in updates && !/^\d{10}$/.test(updates[key]!)) {
      throw new HttpError(400, `${key === "phone_no" ? "Phone" : "WhatsApp"} must be 10 digits`);
    }
  }
  if ("email" in updates && !/^\S+@\S+\.\S+$/.test(updates.email!)) throw new HttpError(400, "Valid email required");

  const [updated] = await db.update(students).set(updates).where(eq(students.id, id)).returning();
  if (!updated) throw new HttpError(404, "Student not found");
  return json(updated);
}

async function adminDeleteStudent(id: string) {
  const deleted = await db.delete(students).where(eq(students.id, id)).returning({ id: students.id });
  if (deleted.length === 0) throw new HttpError(404, "Student not found");
  return json({ message: "Student deleted" });
}

// ---------- Router ----------
async function route(req: Request, url: URL): Promise<Response> {
  const path = url.pathname.replace(/^\/api/, "").replace(/\/+$/, "") || "/";
  const method = req.method;
  let m: RegExpMatchArray | null;

  if (path === "/" && method === "GET") return json({ message: "Taal Tarang Garba API" });
  if (path === "/students/register" && method === "POST") return registerStudent(req);
  if (path === "/admissions/check" && method === "GET") return checkAdmission(url);
  if ((m = path.match(/^\/students\/by-phone\/([^/]+)$/)) && method === "GET") {
    return getStudentByPhone(decodeURIComponent(m[1]));
  }
  if ((m = path.match(/^\/students\/([^/]+)$/)) && method === "GET") return getStudent(decodeURIComponent(m[1]));
  if (path === "/admin/login" && method === "POST") return adminLogin(req);

  if (path.startsWith("/admin/")) {
    requireAdmin(req);
    if (path === "/admin/admissions" && method === "GET") return adminListAdmissions();
    if (path === "/admin/admissions" && method === "POST") return adminAddAdmissions(req);
    if ((m = path.match(/^\/admin\/admissions\/([^/]+)$/)) && method === "DELETE") {
      return adminDeleteAdmission(decodeURIComponent(m[1]));
    }
    if (path === "/admin/students" && method === "GET") return adminListStudents();
    if (path === "/admin/students/export.csv" && method === "GET") return adminExportCsv(url);
    if ((m = path.match(/^\/admin\/students\/([^/]+)$/))) {
      const id = decodeURIComponent(m[1]);
      if (method === "PATCH") return adminUpdateStudent(req, id);
      if (method === "DELETE") return adminDeleteStudent(id);
    }
  }

  throw new HttpError(404, "Not found");
}

export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  try {
    return await route(req, new URL(req.url));
  } catch (err) {
    if (err instanceof HttpError) return json({ detail: err.message }, err.status);
    console.error(err);
    return json({ detail: "Something went wrong. Please try again." }, 500);
  }
};

export const config: Config = {
  path: ["/api", "/api/*"],
};
