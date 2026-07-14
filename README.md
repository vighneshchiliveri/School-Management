# JNV School Management Portal — 2026 Upgrade

A static HTML/CSS/JavaScript school management portal powered by Supabase. It can be deployed directly to Vercel without a build command.

## Major improvements in this version

- Verified Supabase role resolution instead of trusting a browser-only role value
- Page-level access control for Principal, Teacher, and Parent accounts
- Supabase Row Level Security policies for real database authorization
- Parent privacy: parents can access only linked children and published notices
- Principal-controlled teacher Class Access permissions for attendance, grades, students, and timetable
- Redesigned Principal Dashboard with today’s attendance, missing-register alerts, trends, quick actions, notices, and activity history
- Improved Teacher and Parent dashboards
- Safe record archiving instead of immediate permanent deletion
- Activity logging for important create, update, archive, import, attendance, grades, timetable, and operations actions
- Proper CSV parser with validation and preview before importing students
- CSV exports and Print / PDF buttons
- Stronger form validation and safer attendance/grade upserts
- Mobile slide-out navigation, grouped sidebar, icons, user information, and academic session
- Better keyboard access, focus styles, modal roles, Escape support, and focus trapping
- New JNV Operations module for:
  - MOD daily reports
  - Hostel and dormitory matters
  - Mess and hygiene
  - Medical-room visits
  - Staff leave and duty roster
  - Library matters
  - Maintenance complaints
  - Gate passes and visitors
  - Inventory and stock
  - Student welfare

## Required Supabase update

Before using the upgraded website, open **Supabase → SQL Editor** and run these files in this exact order:

1. `sql/supabase-schema.sql`
2. `sql/supabase-security.sql`
3. Optional read-only verification: `sql/verify-install.sql`

The first file creates or upgrades tables, adds archive fields, audit fields, constraints, indexes, and the Operations table.

The second file links existing `username@school.local` Auth accounts to profile records, enables RLS, and creates Principal/Teacher/Parent policies.

Do not skip the security script. Frontend menu hiding alone is not sufficient protection.

## Existing login convention

The portal signs in through Supabase Auth using:

```text
username@school.local
```

Examples:

```text
principal@school.local
teacher1@school.local
parent1@school.local
```

The corresponding username must exist in one of these profile tables:

- `admins` → Principal
- `teachers` → Teacher
- `parents` → Parent

The security script automatically fills `auth_user_id` when the Auth email matches the profile username. For accounts created later, create the Auth user manually in Supabase and either rerun `sql/supabase-security.sql` or set the matching profile row’s `auth_user_id`.

For production safety, keep public self-sign-up disabled in **Supabase → Authentication → Providers / Sign-up settings**. Accounts should be created only by an authorized school administrator.

## Deployment to Vercel

1. Back up the existing GitHub repository and Supabase database.
2. Run the two SQL files listed above.
3. Replace the existing repository files with the contents of this project folder.
4. Commit and push to GitHub.
5. Redeploy the same Vercel project.
6. Sign out completely and sign in again so the verified role is refreshed.

No build command is required. The project is a static website. See `DEPLOYMENT-CHECKLIST.md` for a concise rollout and rollback sequence.

## Important pages

```text
index.html
pages/principal-dashboard.html
pages/teacher-dashboard.html
pages/parent-dashboard.html
pages/students.html
pages/teachers.html
pages/parents.html
pages/attendance.html
pages/grades.html
pages/timetable.html
pages/notices.html
pages/houses.html
pages/operations.html
pages/my-children.html
```

## Recommended verification after deployment

Test each account type separately:

### Principal

- Dashboard data loads
- Add/edit/archive a student
- Import a small test CSV
- Add a teacher and parent
- Open **Class Access** for each teacher and assign permitted class/section combinations
- Link a parent to a student using **Manage Links**
- Save attendance and grades
- Publish a notice
- Add an Operations record
- Confirm Recent Activity updates

### Teacher

- Cannot open Principal-only pages such as Teachers or Parents
- Can view only assigned classes after Class Access has been configured
- Can mark attendance and enter grades only for assigned class/section permissions
- Can view timetable, houses, notices, and operations
- Cannot edit student master records

### Parent

- Can open only Parent Dashboard, My Children, and Notices
- Can see only students linked through `parent_student_links`
- Cannot open the general Attendance, Students, Teachers, Parents, Grades, Timetable, Houses, or Operations pages

## Teacher Class Access migration note

For compatibility with existing accounts, a teacher who has **no rows** in `teacher_class_permissions` temporarily keeps broad legacy class access. As soon as the Principal saves that teacher’s **Class Access** selections, database policies restrict the teacher to those assigned classes and subjects. Configure every teacher after deployment. Saving Class Access with no selected classes intentionally gives that teacher no student, attendance, grade, or timetable class access.

## CSV format

Use `templates/students-template.csv`. The parser supports quoted fields containing commas, including addresses.

Required columns:

```text
full_name,class,section
```

Recommended columns:

```text
admission_no,roll_no,date_of_birth,gender,blood_group,category,house,father_name,mother_name,parent_phone,address
```

## Backup and restoration

Student, teacher, parent, notice, timetable, and operations records are archived by setting `is_archived = true`. They are not permanently deleted by the website. A database administrator can restore a record by setting:

```sql
is_archived = false,
archived_at = null
```
