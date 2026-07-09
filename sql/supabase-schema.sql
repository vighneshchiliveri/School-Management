-- JNV School Management basic Supabase schema
-- Run this in Supabase SQL Editor if any sidebar page says its table is missing.
-- Keep your existing auth users/passwords. This file does not store admin passwords.

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

insert into houses(name) values ('Aravali'), ('Nilgiri'), ('Shivalik'), ('Udaigiri')
on conflict (name) do nothing;
