# Deployment Checklist

## Before updating

1. Download a backup of the current GitHub repository.
2. Back up the Supabase database from the Supabase dashboard.
3. Confirm that public self-sign-up is disabled in Supabase Authentication settings.

## Database update

Run these files in **Supabase → SQL Editor** in this exact order:

1. `sql/supabase-schema.sql`
2. `sql/supabase-security.sql`
3. Optional read-only check: `sql/verify-install.sql`

Do not run the security file before the schema file.

## Website update

1. Replace the current repository contents with this folder.
2. Commit and push the changes to GitHub.
3. Redeploy the existing Vercel project.
4. Sign out of the portal completely and sign in again.

## Required first login checks

### Principal

- Open **Teachers** and use **Set Class Access** for every teacher.
- Open **Parents** and use **Manage Links** for every parent account.
- Check Principal Dashboard alerts.
- Add one test Operations record and confirm Recent Activity updates.
- Test one attendance save and one grade save.

### Teacher

- Confirm Principal-only pages are blocked.
- Confirm only assigned class-sections are visible.
- Confirm attendance and grade entry are limited to assigned access.

### Parent

- Confirm only linked children appear.
- Confirm the general Students, Attendance, Grades, Teachers, Parents, Houses, Timetable, and Operations pages are blocked.

## Rollback

If the website must be rolled back, redeploy the previous GitHub commit. Do not remove the new database columns; they are backward-compatible with the earlier static website.
