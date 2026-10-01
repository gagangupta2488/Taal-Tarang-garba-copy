# Taal Tarang Garba - PRD

## Overview
Mobile event app for the Garba festival at Katni Arts & Commerce College on 12 Oct 2026.

## Features
1. **Home**: Attached festival poster (local asset `assets/images/hero.jpg`), event date, venue, callable contact numbers, Register CTA.
2. **Student Registration**: Admission No (must exist in admin's allowed list), Date of Registration (auto), Full Name, DOB, Father Name, Type (Free-Style/Workshop segmented), Address, Class, Phone, WhatsApp, Email, Photo upload (gallery/camera). On success the pass is saved on-device (AsyncStorage) and the app opens My Pass.
3. **My Pass**: No OTP / phone / approval. Shows the registered student's pass automatically (from device storage, refreshed from backend). Empty state with "Register Now" if not registered; clears if admin deleted the registration.
4. **Admin**: Login with `admin`/`Kacc@8131` (username case/space tolerant, show-password toggle). Search box filters students (name, admission no, phone, class, father, email) and admission list. Two sections: Registered Students (list + delete) and Admission No List (bulk add via comma/newline-separated input, remove, shows registered / not-registered status). Stats: Registered, Admission Nos, Not Yet Registered.

## Tech
- Frontend: Expo Router (4 bottom tabs), react-native, expo-image-picker, expo-linear-gradient, AsyncStorage, Material icons.
- Backend: FastAPI + Motor (MongoDB). Base64 photo storage. Collections: `students`, `allowed_admissions`.
- Theme: Festive Dark (navy #0B132B surface, pink #F72585 primary, orange #FF9E00 secondary, gold #FFD000 tertiary).

## API Endpoints
- POST /api/students/register (403 if admission no not in allowed list, 400 if duplicate)
- GET /api/students/{id}
- POST /api/admin/login
- GET /api/admin/students
- DELETE /api/admin/students/{id}
- GET /api/admin/admissions
- POST /api/admin/admissions  { admission_nos: string[] }
- DELETE /api/admin/admissions/{admission_no}
