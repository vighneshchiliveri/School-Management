# JNV School Management Website

This is a static Supabase-powered school management website for Jawahar Navodaya Vidyalaya.

## Completed sidebar modules

- Admin Dashboard
- Students with CSV import, filters, add/edit/delete, profile, and ID card print
- Teachers
- Parents
- Attendance
- Grades / Marks Entry
- Timetable
- Notices
- Houses
- Parent Dashboard
- My Children parent view

## Folder structure

```text
School-Management-main/
├── index.html
├── css/
│   ├── dashboard.css
│   ├── login.css
│   ├── modules.css
│   └── students.css
├── js/
│   ├── app-config.js
│   ├── login.js
│   ├── admin-dashboard.js
│   ├── teacher-dashboard.js
│   ├── parent-dashboard.js
│   ├── students.js
│   ├── student-profile.js
│   ├── teachers.js
│   ├── parents.js
│   ├── attendance.js
│   ├── grades.js
│   ├── timetable.js
│   ├── notices.js
│   ├── houses.js
│   └── my-children.js
├── pages/
│   ├── admin-dashboard.html
│   ├── teacher-dashboard.html
│   ├── parent-dashboard.html
│   ├── students.html
│   ├── student-profile.html
│   ├── teachers.html
│   ├── parents.html
│   ├── attendance.html
│   ├── grades.html
│   ├── timetable.html
│   ├── notices.html
│   ├── houses.html
│   └── my-children.html
├── templates/
│   ├── students-template.csv
│   └── student-templates.csv
└── sql/
    └── supabase-schema.sql
```

## Supabase setup

The project still uses the existing Supabase URL and anon key from the original website. If a new module shows a table error, open Supabase SQL Editor and run:

```text
sql/supabase-schema.sql
```

Use your existing Supabase Auth users and credentials. Do not hard-code passwords in the frontend.

## Deploy to Vercel

Upload this full folder to GitHub, then redeploy the same Vercel project. No build command is required because this is a static HTML/CSS/JS website.
