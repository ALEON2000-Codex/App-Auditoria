-- Ejecutar este archivo completo en Supabase SQL Editor.
-- Incluye el esquema inicial y los ajustes que necesita la app.

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'auditor' NOT NULL
    CONSTRAINT profiles_role_check CHECK (role IN ('auditor', 'admin', 'super_admin')),
  region TEXT NOT NULL
    CONSTRAINT profiles_region_check CHECK (region IN ('Costa', 'Sierra', 'Global')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.locales (
  codigo_interno TEXT PRIMARY KEY,
  nombre_local TEXT NOT NULL,
  region TEXT NOT NULL
    CONSTRAINT locales_region_check CHECK (region IN ('Costa', 'Sierra', 'Oriente')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.locales (codigo_interno, nombre_local, region)
VALUES
  ('GM', 'Mall del Sol Local', 'Costa'),
  ('QE', 'Amazonas 1', 'Sierra')
ON CONFLICT (codigo_interno) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.checklist_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_text TEXT NOT NULL,
  region TEXT NOT NULL
    CONSTRAINT questions_region_check CHECK (region IN ('Costa', 'Sierra', 'Global')),
  visit_type_id TEXT NOT NULL
    CONSTRAINT questions_visit_check CHECK (visit_type_id IN ('Sabatina', 'Nocturna')),
  score_points NUMERIC DEFAULT 1.0 NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  evidence_required BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.checklist_questions (question_text, region, visit_type_id, score_points, evidence_required)
VALUES
  ('Revision albaranes y mensajes pendientes', 'Global', 'Sabatina', 2.0, false),
  ('La vitrina de pasteleria mantiene la temperatura regulada y limpia?', 'Costa', 'Sabatina', 1.5, true),
  ('El personal de barra cuenta con el uniforme completo e higiene impecable?', 'Sierra', 'Nocturna', 1.0, false)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.audit_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  local_codigo TEXT REFERENCES public.locales(codigo_interno) ON DELETE RESTRICT,
  region TEXT NOT NULL
    CONSTRAINT reports_region_check CHECK (region IN ('Costa', 'Sierra')),
  visit_type_id TEXT NOT NULL,
  responsible_name TEXT NOT NULL,
  auditor_team TEXT NOT NULL,
  status TEXT DEFAULT 'draft' NOT NULL
    CONSTRAINT reports_status_check CHECK (status IN ('draft', 'finalized')),
  final_grade NUMERIC DEFAULT 0.0 NOT NULL,
  final_percentage NUMERIC DEFAULT 0 NOT NULL,
  signature_auditor_url TEXT,
  signature_responsible_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.audit_reports
  DROP CONSTRAINT IF EXISTS reports_visit_check;

ALTER TABLE public.audit_reports
  ADD CONSTRAINT reports_visit_check CHECK (visit_type_id IN ('Sabatina', 'Nocturna'));

CREATE TABLE IF NOT EXISTS public.audit_answers_draft (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.audit_reports(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.checklist_questions(id) ON DELETE RESTRICT,
  value TEXT NOT NULL CHECK (value IN ('cumple', 'no_cumple')),
  observation TEXT NOT NULL,
  evidence_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (report_id, question_id)
);

CREATE TABLE IF NOT EXISTS public.audit_answers_final (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.audit_reports(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.checklist_questions(id) ON DELETE RESTRICT,
  value TEXT NOT NULL CHECK (value IN ('cumple', 'no_cumple')),
  observation TEXT NOT NULL,
  evidence_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (report_id, question_id)
);

CREATE TABLE IF NOT EXISTS public.user_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('auditor', 'admin', 'super_admin')),
  code TEXT NOT NULL UNIQUE,
  is_used BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_answers_draft_report_id
  ON public.audit_answers_draft(report_id);

CREATE INDEX IF NOT EXISTS idx_audit_answers_final_report_id
  ON public.audit_answers_final(report_id);

CREATE INDEX IF NOT EXISTS idx_user_invitations_email
  ON public.user_invitations(email);

INSERT INTO storage.buckets (id, name, public)
VALUES ('evidencias', 'evidencias', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_answers_draft ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_answers_final ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "locales_select_authenticated" ON public.locales;
DROP POLICY IF EXISTS "questions_select_authenticated" ON public.checklist_questions;
DROP POLICY IF EXISTS "questions_admin_write" ON public.checklist_questions;
DROP POLICY IF EXISTS "reports_select_own_or_admin" ON public.audit_reports;
DROP POLICY IF EXISTS "reports_insert_own" ON public.audit_reports;
DROP POLICY IF EXISTS "reports_update_own_or_admin" ON public.audit_reports;
DROP POLICY IF EXISTS "draft_answers_owner_access" ON public.audit_answers_draft;
DROP POLICY IF EXISTS "final_answers_select_own_or_admin" ON public.audit_answers_final;
DROP POLICY IF EXISTS "final_answers_insert_owner" ON public.audit_answers_final;
DROP POLICY IF EXISTS "invitations_admin_access" ON public.user_invitations;
DROP POLICY IF EXISTS "evidencias_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "evidencias_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "evidencias_update_authenticated" ON storage.objects;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "locales_select_authenticated"
  ON public.locales FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "questions_select_authenticated"
  ON public.checklist_questions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "questions_admin_write"
  ON public.checklist_questions FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
  ));

CREATE POLICY "reports_select_own_or_admin"
  ON public.audit_reports FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
  ));

CREATE POLICY "reports_insert_own"
  ON public.audit_reports FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "reports_update_own_or_admin"
  ON public.audit_reports FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
  ))
  WITH CHECK (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
  ));

CREATE POLICY "draft_answers_owner_access"
  ON public.audit_answers_draft FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.audit_reports r
    WHERE r.id = report_id AND r.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.audit_reports r
    WHERE r.id = report_id AND r.user_id = auth.uid()
  ));

CREATE POLICY "final_answers_select_own_or_admin"
  ON public.audit_answers_final FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.audit_reports r
    WHERE r.id = report_id AND (
      r.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
      )
    )
  ));

CREATE POLICY "final_answers_insert_owner"
  ON public.audit_answers_final FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.audit_reports r
    WHERE r.id = report_id AND r.user_id = auth.uid()
  ));

CREATE POLICY "invitations_admin_access"
  ON public.user_invitations FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
  ));

CREATE POLICY "evidencias_select_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'evidencias');

CREATE POLICY "evidencias_insert_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'evidencias');

CREATE POLICY "evidencias_update_authenticated"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'evidencias')
  WITH CHECK (bucket_id = 'evidencias');
