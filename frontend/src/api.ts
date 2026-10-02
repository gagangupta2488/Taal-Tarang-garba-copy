import { Platform } from "react-native";

// The API is served by Netlify Functions on the same site. Web uses same-origin
// requests; native builds need an absolute URL (override with EXPO_PUBLIC_BACKEND_URL).
const BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ??
  (Platform.OS === "web" ? "" : "https://taaltaranggarba.netlify.app");

export const API_URL = `${BASE_URL}/api`;

export type Student = {
  id: string;
  admission_no: string;
  date_of_registration: string;
  full_name: string;
  date_of_birth: string;
  father_name: string;
  type: string;
  address: string;
  student_class: string;
  phone_no: string;
  whatsapp_no: string;
  email: string;
  photo_base64?: string | null;
  approved: boolean;
  created_at: string;
};

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
    return "Request failed";
  } catch {
    return "Request failed";
  }
}

export async function registerStudent(payload: Omit<Student, "id" | "date_of_registration" | "approved" | "created_at">) {
  const res = await fetch(`${API_URL}/students/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as Student;
}

export async function getStudent(id: string) {
  const res = await fetch(`${API_URL}/students/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as Student;
}

export async function getStudentByPhone(phone_no: string) {
  const res = await fetch(`${API_URL}/students/by-phone/${encodeURIComponent(phone_no)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as Student;
}

export async function checkAdmission(admission_no: string) {
  const res = await fetch(`${API_URL}/admissions/check?admission_no=${encodeURIComponent(admission_no)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as { admission_no: string; allowed: boolean; registered: boolean };
}

// Admin session token, kept in memory for the current app session only.
let adminToken: string | null = null;

function adminHeaders(extra?: Record<string, string>) {
  return { ...extra, Authorization: `Bearer ${adminToken ?? ""}` };
}

export async function adminLogin(username: string, password: string) {
  const res = await fetch(`${API_URL}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { token: string; username: string };
  adminToken = data.token;
  return data;
}

export async function adminListStudents() {
  const res = await fetch(`${API_URL}/admin/students`, { cache: "no-store", headers: adminHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as Student[];
}

export async function adminDeleteStudent(id: string) {
  const res = await fetch(`${API_URL}/admin/students/${id}`, { method: "DELETE", headers: adminHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as { message: string };
}

export type StudentType = "Free-Style" | "Workshop";

export type StudentUpdate = Partial<
  Pick<Student, "full_name" | "father_name" | "date_of_birth" | "address" | "student_class" | "phone_no" | "whatsapp_no" | "email">
> & { type?: StudentType };

export async function adminUpdateStudent(id: string, payload: StudentUpdate) {
  const res = await fetch(`${API_URL}/admin/students/${id}`, {
    method: "PATCH",
    headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as Student;
}

export function adminExportUrl(type?: StudentType | null) {
  const qs = type ? `?type=${encodeURIComponent(type)}` : "";
  return `${API_URL}/admin/students/export.csv${qs}`;
}

export async function adminFetchExportCsv(type?: StudentType | null) {
  const res = await fetch(adminExportUrl(type), { cache: "no-store", headers: adminHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  return await res.text();
}

export type AdmissionEntry = { admission_no: string; created_at: string };

export async function adminListAdmissions() {
  const res = await fetch(`${API_URL}/admin/admissions`, { cache: "no-store", headers: adminHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as AdmissionEntry[];
}

export async function adminAddAdmissions(admission_nos: string[]) {
  const res = await fetch(`${API_URL}/admin/admissions`, {
    method: "POST",
    headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ admission_nos }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as { added: number; skipped: number };
}

export async function adminDeleteAdmission(admission_no: string) {
  const res = await fetch(`${API_URL}/admin/admissions/${encodeURIComponent(admission_no)}`, {
    method: "DELETE",
    headers: adminHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as { message: string };
}
