-- JNV School Management schema and safe migrations
-- Run this file first in Supabase SQL Editor.
-- It is idempotent: it can be run again after future updates.

create extension if not exists pgcrypto;

create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  username text unique not null,
  full_name text,
  created_at timestamptz default now()
);

create table if not exists teachers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  username text unique,
  full_name text not null,
  employee_id text unique,
  designation text,
  subject text,
  phone text,
  email text,
  class_teacher_of text,
  house text,
  status text default 'Active',
  permissions_configured boolean not null default false,
  address text,
  created_at timestamptz default now()
);

create table if not exists parents (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  username text unique,
  full_name text not null,
  phone text,
  email text,
  village text,
  relation text,
  address text,
  created_at timestamptz default now()
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  admission_no text unique,
  class text,
  section text,
  roll_no text,
  date_of_birth date,
  gender text,
  blood_group text,
  category text,
  house text,
  father_name text,
  mother_name text,
  parent_phone text,
  address text,
  created_at timestamptz default now()
);

create table if not exists parent_student_links (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references parents(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  created_at timestamptz default now(),
  unique(parent_id, student_id)
);

create table if not exists teacher_class_permissions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  class text not null,
  section text not null,
  subject text,
  can_mark_attendance boolean not null default true,
  can_enter_grades boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists teacher_class_permissions_unique_idx
  on teacher_class_permissions(teacher_id, class, section, coalesce(subject, ''));

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  date date not null,
  class text,
  section text,
  status text not null default 'Present',
  remarks text,
  created_at timestamptz default now(),
  unique(student_id, date)
);

create table if not exists grades (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  exam_name text not null,
  subject text not null,
  class text,
  section text,
  marks_obtained numeric,
  max_marks numeric default 100,
  grade text,
  remarks text,
  created_at timestamptz default now(),
  unique(student_id, exam_name, subject)
);

create table if not exists timetable (
  id uuid primary key default gen_random_uuid(),
  class text not null,
  section text not null,
  day text not null,
  period_no integer not null,
  subject text not null,
  teacher_name text,
  start_time time,
  end_time time,
  created_at timestamptz default now()
);

create table if not exists notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  audience text default 'All',
  is_published boolean default true,
  created_by text,
  published_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists houses (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  house_master text,
  color text,
  created_at timestamptz default now()
);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  details text,
  actor_role text,
  created_at timestamptz default now()
);

-- Legacy timetable compatibility.
-- Some earlier databases used the column name "period" instead of "period_no".
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'timetable' and column_name = 'period'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'timetable' and column_name = 'period_no'
  ) then
    alter table timetable rename column period to period_no;
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'timetable' and column_name = 'period_no'
  ) then
    alter table timetable add column period_no integer;
  end if;
end $$;

-- Safe archive fields. The website archives records instead of permanently deleting them.
alter table teachers add column if not exists is_archived boolean not null default false;
alter table teachers add column if not exists archived_at timestamptz;
alter table teachers add column if not exists permissions_configured boolean not null default false;
alter table parents add column if not exists is_archived boolean not null default false;
alter table parents add column if not exists archived_at timestamptz;
alter table students add column if not exists is_archived boolean not null default false;
alter table students add column if not exists archived_at timestamptz;
alter table timetable add column if not exists is_archived boolean not null default false;
alter table timetable add column if not exists archived_at timestamptz;
alter table notices add column if not exists is_archived boolean not null default false;
alter table notices add column if not exists archived_at timestamptz;

-- Audit metadata.
alter table activity_log add column if not exists actor_name text;
alter table activity_log add column if not exists actor_user_id uuid;
alter table notices add column if not exists created_by_user_id uuid;

-- Preserve the newest active timetable row if legacy data contains duplicate slots.
-- Older duplicates are archived, not deleted.
with ranked_timetable as (
  select id, row_number() over (
    partition by class, section, day, period_no
    order by created_at desc nulls last, id desc
  ) as duplicate_rank
  from timetable
  where not coalesce(is_archived, false)
)
update timetable
set is_archived = true, archived_at = coalesce(archived_at, now())
where id in (select id from ranked_timetable where duplicate_rank > 1);

drop index if exists timetable_unique_slot_idx;
create unique index if not exists timetable_active_unique_slot_idx
  on timetable(class, section, day, period_no)
  where not is_archived;

-- Residential-school and administrative operations in one flexible module.
create table if not exists school_operations (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  description text not null,
  status text not null default 'Open',
  priority text not null default 'Medium',
  event_date date,
  assigned_to text,
  student_name text,
  class_section text,
  created_by text,
  created_by_user_id uuid,
  is_archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helpful indexes for dashboard and filters.
create index if not exists attendance_date_idx on attendance(date);
create index if not exists attendance_class_section_idx on attendance(class, section, date);
create index if not exists grades_student_idx on grades(student_id, created_at desc);
create index if not exists notices_published_idx on notices(is_published, created_at desc);
create index if not exists operations_status_idx on school_operations(status, priority, created_at desc);
create index if not exists parent_links_parent_idx on parent_student_links(parent_id);
create index if not exists parent_links_student_idx on parent_student_links(student_id);
create index if not exists teacher_permissions_teacher_idx on teacher_class_permissions(teacher_id, class, section);

-- Preserve explicit permissions if this migration is rerun after Class Access has already been configured.
update teachers teacher
set permissions_configured = true
where exists (select 1 from teacher_class_permissions permission where permission.teacher_id = teacher.id);

-- Basic data checks.
do $$ begin
  alter table attendance add constraint attendance_status_check check (status in ('Present','Absent','Late','Leave'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table grades add constraint grades_marks_check check (
    marks_obtained is null or (marks_obtained >= 0 and max_marks > 0 and marks_obtained <= max_marks)
  );
exception when duplicate_object then null; end $$;

do $$ begin
  alter table school_operations add constraint operations_status_check check (status in ('Open','In Progress','Completed','Closed'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table school_operations add constraint operations_priority_check check (priority in ('High','Medium','Low'));
exception when duplicate_object then null; end $$;

insert into houses(name) values ('Aravali'), ('Nilgiri'), ('Shivalik'), ('Udaigiri')
on conflict (name) do nothing;
