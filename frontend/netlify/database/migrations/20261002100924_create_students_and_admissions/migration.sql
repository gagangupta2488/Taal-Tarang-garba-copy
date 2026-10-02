CREATE TABLE "allowed_admissions" (
	"admission_no" text PRIMARY KEY,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" text PRIMARY KEY,
	"admission_no" text NOT NULL UNIQUE,
	"date_of_registration" text NOT NULL,
	"full_name" text NOT NULL,
	"date_of_birth" text NOT NULL,
	"father_name" text NOT NULL,
	"type" text NOT NULL,
	"address" text NOT NULL,
	"student_class" text NOT NULL,
	"phone_no" text NOT NULL,
	"whatsapp_no" text NOT NULL,
	"email" text NOT NULL,
	"photo_base64" text,
	"approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
