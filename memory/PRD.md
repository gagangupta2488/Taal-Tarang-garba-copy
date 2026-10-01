# Taal Tarang Garba - PRD

## Overview
Mobile event app for the Garba festival at Katni Arts & Commerce College on 12 Oct 2026.

## Features
1. **Home**: Hero banner, event date, venue, callable contact numbers, Register CTA.
2. **Student Registration**: Admission No, Date of Registration (auto), Full Name, DOB, Father Name, Type (Free-Style/Workshop segmented), Address, Class, Phone, WhatsApp, Email, Photo upload (gallery/camera).
3. **My Pass**: Lookup registration by phone number + mock OTP `123456`. Shows beautiful pass card with photo, student info, and status badge (Pending Approval / Approved).
4. **Admin**: Login with `admin`/`admin123`, list all registrations, filter All/Pending/Approved, approve or delete students, stats cards, pull-to-refresh.

## Tech
- Frontend: Expo Router (4 bottom tabs), react-native, expo-image-picker, expo-linear-gradient, expo-blur, Material icons.
- Backend: FastAPI + Motor (MongoDB). Base64 photo storage.
- Theme: Festive Dark (navy #0B132B surface, pink #F72585 primary, orange #FF9E00 secondary, gold #FFD000 tertiary).

## API Endpoints
- POST /api/students/register
- POST /api/students/send-otp
- POST /api/students/verify-otp
- POST /api/admin/login
- GET /api/admin/students
- POST /api/admin/students/{id}/approve
- DELETE /api/admin/students/{id}
