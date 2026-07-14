-- Read-only verification for the JNV School Management upgrade.
-- Run after supabase-schema.sql and supabase-security.sql.

select
  to_regclass('public.students') as students_table,
  to_regclass('public.teacher_class_permissions') as teacher_permissions_table,
  to_regclass('public.school_operations') as operations_table,
  to_regclass('public.activity_log') as activity_log_table;

select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where oid in (
  'public.admins'::regclass, 'public.teachers'::regclass, 'public.parents'::regclass,
  'public.students'::regclass, 'public.parent_student_links'::regclass,
  'public.teacher_class_permissions'::regclass, 'public.attendance'::regclass,
  'public.grades'::regclass, 'public.timetable'::regclass, 'public.notices'::regclass,
  'public.houses'::regclass, 'public.activity_log'::regclass,
  'public.school_operations'::regclass
)
order by relname;

select tablename, count(*) as policy_count
from pg_policies
where schemaname = 'public'
  and tablename in (
    'admins','teachers','parents','students','parent_student_links',
    'teacher_class_permissions','attendance','grades','timetable','notices',
    'houses','activity_log','school_operations'
  )
group by tablename
order by tablename;

select
  count(*) filter (where not coalesce(is_archived, false)) as active_teachers,
  count(*) filter (where not coalesce(is_archived, false) and not permissions_configured) as teachers_pending_class_access
from public.teachers;

select
  (select count(*) from public.parent_student_links) as parent_student_links,
  (select count(*) from public.teacher_class_permissions) as teacher_class_permissions,
  (select count(*) from public.school_operations where not is_archived) as active_operations;
