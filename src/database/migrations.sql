-- ====================================================================
-- RIMT UNIVERSITY: COMPLETE DATABASE SCHEMA FOR BACKEND API
-- This migration consolidates all tables needed by the Backend API.
-- Run this in the Supabase SQL Editor if tables don't already exist.
-- All statements are idempotent (safe to run multiple times).
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- 1. STUDENTS TABLE (Core enrollment & onboarding)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT,
  name TEXT,
  roll_number TEXT,
  roll_no TEXT,
  department TEXT,
  course TEXT,
  year_semester TEXT,
  batch TEXT,
  semester TEXT,
  email TEXT,
  password_hash TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED')),
  role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
  rejection_reason TEXT,
  revocation_reason TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  phone TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  headline TEXT,
  bio TEXT,
  about_me TEXT,
  skills TEXT[] DEFAULT '{}',
  projects JSONB DEFAULT '[]'::jsonb,
  semester_scores JSONB DEFAULT '[]'::jsonb,
  certificates JSONB DEFAULT '[]'::jsonb,
  internships JSONB DEFAULT '[]'::jsonb,
  cgpa NUMERIC(4,2),
  academic_score NUMERIC(5,1),
  current_semester INT,
  attendance_rate NUMERIC(5,2),
  academic_standing TEXT,
  active_backlogs INT DEFAULT 0,
  total_credits INT,
  faculty_advisor TEXT,
  admin_notes TEXT,
  resume_url TEXT,
  linkedin_url TEXT,
  github_url TEXT,
  portfolio_url TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_students_status ON public.students (status);
CREATE INDEX IF NOT EXISTS idx_students_roll_no ON public.students (upper(trim(coalesce(roll_no, ''))));

-- ====================================================================
-- 2. ADMINS TABLE
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  profile_pic_url TEXT,
  role TEXT NOT NULL DEFAULT 'ADMIN' CHECK (role IN ('ADMIN', 'SUPER_ADMIN')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- 3. STUDENT DOSSIER TABLES
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.student_profiles (
  student_id UUID PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  bio TEXT,
  headline TEXT,
  skills TEXT[] DEFAULT '{}',
  linkedin_url TEXT,
  github_url TEXT,
  portfolio_url TEXT,
  resume_url TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  tech_stack TEXT[] DEFAULT '{}',
  live_url TEXT,
  start_date DATE,
  end_date DATE,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_git_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  repo_name TEXT NOT NULL,
  repo_url TEXT NOT NULL,
  description TEXT,
  primary_language TEXT,
  stars INT DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.student_projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  issuer TEXT,
  issue_date DATE,
  credential_id TEXT,
  credential_url TEXT,
  file_path TEXT,
  file_mime TEXT,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_internships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  role_title TEXT NOT NULL,
  location TEXT,
  mode TEXT CHECK (mode IN ('onsite','remote','hybrid')),
  start_date DATE,
  end_date DATE,
  is_ongoing BOOLEAN NOT NULL DEFAULT false,
  stipend NUMERIC,
  description TEXT,
  offer_letter_path TEXT,
  completion_certificate_path TEXT,
  status TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing','completed','terminated')),
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ====================================================================
-- 4. ACADEMIC RECORDS (Admin-managed)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.student_academic_summary (
  student_id UUID PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  cgpa NUMERIC(4,2) CHECK (cgpa BETWEEN 0 AND 10),
  overall_attendance NUMERIC(5,2) CHECK (overall_attendance BETWEEN 0 AND 100),
  backlogs INT CHECK (backlogs >= 0),
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_semester_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  semester INT NOT NULL CHECK (semester BETWEEN 1 AND 12),
  academic_year TEXT,
  sgpa NUMERIC(4,2) CHECK (sgpa BETWEEN 0 AND 10),
  attendance_pct NUMERIC(5,2) CHECK (attendance_pct BETWEEN 0 AND 100),
  remarks TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, semester)
);

CREATE TABLE IF NOT EXISTS public.student_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  semester INT NOT NULL,
  subject_code TEXT,
  subject_name TEXT NOT NULL,
  credits NUMERIC(3,1),
  grade TEXT,
  grade_points NUMERIC(4,2),
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, semester, subject_name)
);

-- ====================================================================
-- 5. STUDENT DOCUMENTS TABLE
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.student_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_no TEXT NOT NULL,
  title TEXT,
  original_filename TEXT,
  mime_type TEXT,
  file_size BIGINT,
  cloudinary_url TEXT,
  url TEXT,
  cloudinary_public_id TEXT,
  storage_provider TEXT DEFAULT 'cloudinary',
  resource_type TEXT DEFAULT 'raw',
  format TEXT,
  status TEXT DEFAULT 'Verified',
  document_type TEXT DEFAULT 'CERTIFICATE',
  issuer TEXT,
  credential_id TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_student_documents_roll
  ON public.student_documents (upper(trim(roll_no)));

-- ====================================================================
-- 6. NOTIFICATIONS TABLE
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('internship', 'drive', 'announcement', 'general', 'system')),
  priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  target_type TEXT NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'department', 'batch', 'student')),
  target_id TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_route TEXT DEFAULT 'placement',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT DEFAULT 'T&P Administration',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications (type);

-- ====================================================================
-- 7. NOTIFICATION READ RECEIPTS
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.student_notification_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  roll_no TEXT NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unq_student_notification_read UNIQUE (notification_id, roll_no)
);

-- ====================================================================
-- 8. FCM TOKEN STORAGE
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_no TEXT NOT NULL,
  token TEXT NOT NULL,
  device_platform TEXT DEFAULT 'android' CHECK (device_platform IN ('android', 'ios', 'web')),
  token_type TEXT DEFAULT 'fcm' CHECK (token_type IN ('fcm', 'expo')),
  is_active BOOLEAN DEFAULT true,
  last_refreshed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fcm_tokens_roll_token
  ON public.fcm_tokens (upper(trim(roll_no)), token);

-- ====================================================================
-- 9. ADMIN AUDIT LOG
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id UUID,
  student_id UUID,
  table_name TEXT NOT NULL,
  record_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('insert','update','delete')),
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ====================================================================
-- 10. RLS POLICIES (Permissive for development)
-- ====================================================================

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_notification_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Grant full access to service_role (backend API uses service role key)
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- ====================================================================
-- 11. REALTIME PUBLICATION
-- ====================================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'students', 'student_profiles', 'student_academic_summary',
    'notifications', 'student_notification_reads'
  ];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY tables LOOP
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
        BEGIN
          EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
      END IF;
    END LOOP;
  END IF;
END $$;
