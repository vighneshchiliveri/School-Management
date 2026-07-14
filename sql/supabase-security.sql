-- JNV School Management Row Level Security
-- Run AFTER sql/supabase-schema.sql in Supabase SQL Editor.
-- This script makes browser-side role changes ineffective because permissions are checked in PostgreSQL.

create or replace function public.current_username()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1));
$$;

create or replace function public.current_app_role()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return null; end if;

  if exists (
    select 1 from public.admins
    where auth_user_id = auth.uid()
       or (auth_user_id is null and lower(username) = public.current_username())
  ) then return 'principal'; end if;

  if exists (
    select 1 from public.teachers
    where not coalesce(is_archived, false)
      and (auth_user_id = auth.uid()
       or (auth_user_id is null and lower(username) = public.current_username()))
  ) then return 'teacher'; end if;

  if exists (
    select 1 from public.parents
    where not coalesce(is_archived, false)
      and (auth_user_id = auth.uid()
       or (auth_user_id is null and lower(username) = public.current_username()))
  ) then return 'parent'; end if;

  return null;
end;
$$;

create or replace function public.current_parent_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.parents
  where not coalesce(is_archived, false)
    and (auth_user_id = auth.uid()
      or (auth_user_id is null and lower(username) = public.current_username()))
  limit 1;
$$;

create or replace function public.current_teacher_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.teachers
  where not coalesce(is_archived, false)
    and (auth_user_id = auth.uid()
      or (auth_user_id is null and lower(username) = public.current_username()))
  limit 1;
$$;

create or replace function public.teacher_can_access_class(target_class text, target_section text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare teacher_uuid uuid;
declare configured boolean;
begin
  if public.current_app_role() = 'principal' then return true; end if;
  if public.current_app_role() <> 'teacher' then return false; end if;
  teacher_uuid := public.current_teacher_id();
  if teacher_uuid is null then return false; end if;
  select permissions_configured into configured from public.teachers where id = teacher_uuid;
  -- Legacy-safe fallback only until a principal explicitly saves Class Access.
  if not coalesce(configured, false) then return true; end if;
  return exists (
    select 1 from public.teacher_class_permissions
    where teacher_id = teacher_uuid and class = target_class and section = target_section
  );
end;
$$;

create or replace function public.teacher_can_mark_attendance(target_class text, target_section text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare teacher_uuid uuid;
declare configured boolean;
begin
  if public.current_app_role() = 'principal' then return true; end if;
  if public.current_app_role() <> 'teacher' then return false; end if;
  teacher_uuid := public.current_teacher_id();
  if teacher_uuid is null then return false; end if;
  select permissions_configured into configured from public.teachers where id = teacher_uuid;
  if not coalesce(configured, false) then return true; end if;
  return exists (
    select 1 from public.teacher_class_permissions
    where teacher_id = teacher_uuid and class = target_class and section = target_section and can_mark_attendance
  );
end;
$$;

create or replace function public.teacher_can_enter_grades(target_class text, target_section text, target_subject text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare teacher_uuid uuid;
declare configured boolean;
begin
  if public.current_app_role() = 'principal' then return true; end if;
  if public.current_app_role() <> 'teacher' then return false; end if;
  teacher_uuid := public.current_teacher_id();
  if teacher_uuid is null then return false; end if;
  select permissions_configured into configured from public.teachers where id = teacher_uuid;
  if not coalesce(configured, false) then return true; end if;
  return exists (
    select 1 from public.teacher_class_permissions
    where teacher_id = teacher_uuid
      and class = target_class
      and section = target_section
      and can_enter_grades
      and (subject is null or btrim(subject) = '' or lower(subject) = lower(target_subject))
  );
end;
$$;

revoke all on function public.current_username() from public;
revoke all on function public.current_app_role() from public;
revoke all on function public.current_parent_id() from public;
revoke all on function public.current_teacher_id() from public;
revoke all on function public.teacher_can_access_class(text,text) from public;
revoke all on function public.teacher_can_mark_attendance(text,text) from public;
revoke all on function public.teacher_can_enter_grades(text,text,text) from public;
grant execute on function public.current_username() to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_parent_id() to authenticated;
grant execute on function public.current_teacher_id() to authenticated;
grant execute on function public.teacher_can_access_class(text,text) to authenticated;
grant execute on function public.teacher_can_mark_attendance(text,text) to authenticated;
grant execute on function public.teacher_can_enter_grades(text,text,text) to authenticated;

create or replace function public.current_display_name()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare display_name text;
begin
  if public.current_app_role() = 'principal' then
    select coalesce(full_name, username) into display_name from public.admins
    where auth_user_id = auth.uid() or (auth_user_id is null and lower(username) = public.current_username()) limit 1;
  elsif public.current_app_role() = 'teacher' then
    select coalesce(full_name, username) into display_name from public.teachers
    where auth_user_id = auth.uid() or (auth_user_id is null and lower(username) = public.current_username()) limit 1;
  elsif public.current_app_role() = 'parent' then
    select coalesce(full_name, username) into display_name from public.parents
    where auth_user_id = auth.uid() or (auth_user_id is null and lower(username) = public.current_username()) limit 1;
  end if;
  return coalesce(display_name, public.current_username());
end;
$$;

create or replace function public.stamp_activity_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.actor_role := public.current_app_role();
  new.actor_name := public.current_display_name();
  new.actor_user_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists activity_actor_stamp on public.activity_log;
create trigger activity_actor_stamp
before insert on public.activity_log
for each row execute function public.stamp_activity_actor();

create or replace function public.stamp_portal_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'notices' then
    if tg_op = 'INSERT' then
      new.created_by := public.current_display_name();
      new.created_by_user_id := auth.uid();
    else
      new.created_by := old.created_by;
      new.created_by_user_id := old.created_by_user_id;
    end if;
  elsif tg_table_name = 'school_operations' then
    if tg_op = 'INSERT' then
      new.created_by := public.current_display_name();
      new.created_by_user_id := auth.uid();
    else
      new.created_by := old.created_by;
      new.created_by_user_id := old.created_by_user_id;
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists notices_creator_stamp on public.notices;
create trigger notices_creator_stamp before insert or update on public.notices
for each row execute function public.stamp_portal_creator();
drop trigger if exists operations_creator_stamp on public.school_operations;
create trigger operations_creator_stamp before insert or update on public.school_operations
for each row execute function public.stamp_portal_creator();

revoke all on function public.current_display_name() from public;
revoke all on function public.stamp_activity_actor() from public;
revoke all on function public.stamp_portal_creator() from public;
grant execute on function public.current_display_name() to authenticated;

-- Link existing profile rows to Supabase Auth users by the website's username@school.local convention.
update public.admins profile
set auth_user_id = auth_user.id
from auth.users auth_user
where profile.auth_user_id is null
  and lower(auth_user.email) = lower(profile.username || '@school.local');

update public.teachers profile
set auth_user_id = auth_user.id
from auth.users auth_user
where profile.auth_user_id is null
  and profile.username is not null
  and lower(auth_user.email) = lower(profile.username || '@school.local');

update public.parents profile
set auth_user_id = auth_user.id
from auth.users auth_user
where profile.auth_user_id is null
  and profile.username is not null
  and lower(auth_user.email) = lower(profile.username || '@school.local');

alter table public.admins enable row level security;
alter table public.teachers enable row level security;
alter table public.parents enable row level security;
alter table public.students enable row level security;
alter table public.parent_student_links enable row level security;
alter table public.teacher_class_permissions enable row level security;
alter table public.attendance enable row level security;
alter table public.grades enable row level security;
alter table public.timetable enable row level security;
alter table public.notices enable row level security;
alter table public.houses enable row level security;
alter table public.activity_log enable row level security;
alter table public.school_operations enable row level security;

-- Remove old policies with these names before recreating them.
drop policy if exists admins_select on public.admins;
drop policy if exists admins_manage on public.admins;
drop policy if exists teachers_select on public.teachers;
drop policy if exists teachers_manage on public.teachers;
drop policy if exists parents_select on public.parents;
drop policy if exists parents_manage on public.parents;
drop policy if exists students_select on public.students;
drop policy if exists students_manage on public.students;
drop policy if exists links_select on public.parent_student_links;
drop policy if exists links_manage on public.parent_student_links;
drop policy if exists teacher_permissions_select on public.teacher_class_permissions;
drop policy if exists teacher_permissions_manage on public.teacher_class_permissions;
drop policy if exists attendance_select on public.attendance;
drop policy if exists attendance_manage on public.attendance;
drop policy if exists grades_select on public.grades;
drop policy if exists grades_manage on public.grades;
drop policy if exists timetable_select on public.timetable;
drop policy if exists timetable_manage on public.timetable;
drop policy if exists notices_select on public.notices;
drop policy if exists notices_manage on public.notices;
drop policy if exists houses_select on public.houses;
drop policy if exists houses_manage on public.houses;
drop policy if exists activity_select on public.activity_log;
drop policy if exists activity_insert on public.activity_log;
drop policy if exists operations_select on public.school_operations;
drop policy if exists operations_manage on public.school_operations;

create policy admins_select on public.admins
for select to authenticated
using (
  public.current_app_role() = 'principal'
  or auth_user_id = auth.uid()
  or (auth_user_id is null and lower(username) = public.current_username())
);
create policy admins_manage on public.admins
for all to authenticated
using (public.current_app_role() = 'principal')
with check (public.current_app_role() = 'principal');

create policy teachers_select on public.teachers
for select to authenticated
using (
  public.current_app_role() = 'principal'
  or auth_user_id = auth.uid()
  or (auth_user_id is null and lower(username) = public.current_username())
);
create policy teachers_manage on public.teachers
for all to authenticated
using (public.current_app_role() = 'principal')
with check (public.current_app_role() = 'principal');

create policy parents_select on public.parents
for select to authenticated
using (
  public.current_app_role() = 'principal'
  or auth_user_id = auth.uid()
  or (auth_user_id is null and lower(username) = public.current_username())
);
create policy parents_manage on public.parents
for all to authenticated
using (public.current_app_role() = 'principal')
with check (public.current_app_role() = 'principal');

create policy students_select on public.students
for select to authenticated
using (
  public.current_app_role() = 'principal'
  or (not coalesce(students.is_archived, false) and public.current_app_role() = 'teacher' and public.teacher_can_access_class(students.class, students.section))
  or (not coalesce(students.is_archived, false) and exists (
    select 1 from public.parent_student_links psl
    where psl.student_id = students.id
      and psl.parent_id = public.current_parent_id()
  ))
);
create policy students_manage on public.students
for all to authenticated
using (public.current_app_role() = 'principal')
with check (public.current_app_role() = 'principal');

create policy links_select on public.parent_student_links
for select to authenticated
using (
  public.current_app_role() = 'principal'
  or parent_id = public.current_parent_id()
);
create policy links_manage on public.parent_student_links
for all to authenticated
using (public.current_app_role() = 'principal')
with check (public.current_app_role() = 'principal');

create policy teacher_permissions_select on public.teacher_class_permissions
for select to authenticated
using (
  public.current_app_role() = 'principal'
  or teacher_id = public.current_teacher_id()
);
create policy teacher_permissions_manage on public.teacher_class_permissions
for all to authenticated
using (public.current_app_role() = 'principal')
with check (public.current_app_role() = 'principal');

create policy attendance_select on public.attendance
for select to authenticated
using (
  public.current_app_role() = 'principal'
  or (public.current_app_role() = 'teacher' and public.teacher_can_mark_attendance(attendance.class, attendance.section))
  or exists (
    select 1 from public.parent_student_links psl
    where psl.student_id = attendance.student_id
      and psl.parent_id = public.current_parent_id()
  )
);
create policy attendance_manage on public.attendance
for all to authenticated
using (public.teacher_can_mark_attendance(attendance.class, attendance.section))
with check (public.teacher_can_mark_attendance(attendance.class, attendance.section));

create policy grades_select on public.grades
for select to authenticated
using (
  public.current_app_role() = 'principal'
  or (public.current_app_role() = 'teacher' and public.teacher_can_enter_grades(grades.class, grades.section, grades.subject))
  or exists (
    select 1 from public.parent_student_links psl
    where psl.student_id = grades.student_id
      and psl.parent_id = public.current_parent_id()
  )
);
create policy grades_manage on public.grades
for all to authenticated
using (public.teacher_can_enter_grades(grades.class, grades.section, grades.subject))
with check (public.teacher_can_enter_grades(grades.class, grades.section, grades.subject));

create policy timetable_select on public.timetable
for select to authenticated
using (
  public.current_app_role() = 'principal'
  or (not coalesce(timetable.is_archived, false) and public.current_app_role() = 'teacher' and public.teacher_can_access_class(timetable.class, timetable.section))
  or (
    not coalesce(timetable.is_archived, false)
    and public.current_app_role() = 'parent'
    and exists (
      select 1 from public.parent_student_links psl
      join public.students student on student.id = psl.student_id
      where psl.parent_id = public.current_parent_id()
        and student.class = timetable.class
        and student.section = timetable.section
    )
  )
);
create policy timetable_manage on public.timetable
for all to authenticated
using (public.teacher_can_access_class(timetable.class, timetable.section))
with check (public.teacher_can_access_class(timetable.class, timetable.section));

create policy notices_select on public.notices
for select to authenticated
using (
  public.current_app_role() = 'principal'
  or (
    public.current_app_role() = 'teacher'
    and is_published = true
    and not coalesce(is_archived, false)
    and audience in ('All','Teachers')
  )
  or (
    public.current_app_role() = 'parent'
    and is_published = true
    and not coalesce(is_archived, false)
    and audience in ('All','Parents')
  )
);
create policy notices_manage on public.notices
for all to authenticated
using (public.current_app_role() = 'principal')
with check (public.current_app_role() = 'principal');

create policy houses_select on public.houses
for select to authenticated
using (public.current_app_role() is not null);
create policy houses_manage on public.houses
for all to authenticated
using (public.current_app_role() = 'principal')
with check (public.current_app_role() = 'principal');

create policy activity_select on public.activity_log
for select to authenticated
using (public.current_app_role() = 'principal');
create policy activity_insert on public.activity_log
for insert to authenticated
with check (public.current_app_role() in ('principal','teacher'));

create policy operations_select on public.school_operations
for select to authenticated
using (
  public.current_app_role() = 'principal'
  or (public.current_app_role() = 'teacher' and not coalesce(is_archived, false))
);
create policy operations_manage on public.school_operations
for all to authenticated
using (public.current_app_role() in ('principal','teacher'))
with check (public.current_app_role() in ('principal','teacher'));

-- Remove direct anonymous access. Login uses Supabase Auth and does not need table access.
revoke all on public.admins, public.teachers, public.parents, public.students,
  public.parent_student_links, public.teacher_class_permissions, public.attendance,
  public.grades, public.timetable, public.notices, public.houses,
  public.activity_log, public.school_operations from anon;

-- Explicit privileges; RLS policies still determine which rows can be used.
grant usage on schema public to authenticated;
grant select, insert, update on public.admins to authenticated;
grant select, insert, update on public.teachers to authenticated;
grant select, insert, update on public.parents to authenticated;
grant select, insert, update on public.students to authenticated;
grant select, insert, update, delete on public.parent_student_links to authenticated;
grant select, insert, update, delete on public.teacher_class_permissions to authenticated;
grant select, insert, update on public.attendance to authenticated;
grant select, insert, update on public.grades to authenticated;
grant select, insert, update on public.timetable to authenticated;
grant select, insert, update on public.notices to authenticated;
grant select, insert, update on public.houses to authenticated;
grant select, insert on public.activity_log to authenticated;
grant select, insert, update on public.school_operations to authenticated;
