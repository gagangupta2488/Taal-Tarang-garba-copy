import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Column keys mirror the JSON shape the app already uses (snake_case).
export const students = pgTable("students", {
  id: text("id").primaryKey(),
  admission_no: text("admission_no").notNull().unique(),
  date_of_registration: text("date_of_registration").notNull(),
  full_name: text("full_name").notNull(),
  date_of_birth: text("date_of_birth").notNull(),
  father_name: text("father_name").notNull(),
  type: text("type").notNull(),
  address: text("address").notNull(),
  student_class: text("student_class").notNull(),
  phone_no: text("phone_no").notNull(),
  whatsapp_no: text("whatsapp_no").notNull(),
  email: text("email").notNull(),
  photo_base64: text("photo_base64"),
  approved: boolean("approved").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const allowedAdmissions = pgTable("allowed_admissions", {
  admission_no: text("admission_no").primaryKey(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
