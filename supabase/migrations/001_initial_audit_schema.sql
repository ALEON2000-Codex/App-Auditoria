create extension if not exists "pgcrypto";

create type public.app_region as enum ('costa', 'sierra');
create type public.app_role as enum ('auditor', 'regional_admin', 'vip', 'super_admin');
create type public.visit_status as enum ('draft', 'finalized', 'voided');
create type public.answer_value as enum ('complies', 'does_not_comply');
create type public.signature_kind as enum ('auditor', 'responsible');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  region public.app_region not null,
  role public.app_role not null default 'auditor',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  region public.app_region not null,
  role public.app_role not null default 'auditor',
  invited_by uuid references public.profiles(id),
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invitations_email_lowercase check (email = lower(email))
);

create table public.corporate_email_domains (
  domain text primary key,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint corporate_domain_format check (domain !~ '@' and domain = lower(domain))
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  region public.app_region not null,
  name text not null,
  code text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (region, name)
);

create table public.store_responsibles (
  id uuid primary key default gen_random_uuid(),
  region public.app_region not null,
  store_id uuid not null references public.stores(id),
  full_name text not null,
  position text,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.audit_teams (
  id uuid primary key default gen_random_uuid(),
  region public.app_region not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (region, name)
);

create table public.audit_team_members (
  audit_team_id uuid not null references public.audit_teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  primary key (audit_team_id, user_id)
);

create table public.visit_types (
  id uuid primary key default gen_random_uuid(),
  region public.app_region not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (region, name)
);

create table public.checklist_questions (
  id uuid primary key default gen_random_uuid(),
  region public.app_region not null,
  visit_type_id uuid not null references public.visit_types(id),
  code text not null,
  prompt text not null,
  max_score numeric(8,2) not null check (max_score > 0),
  is_critical boolean not null default false,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (region, visit_type_id, code)
);

create table public.audit_reports (
  id uuid primary key default gen_random_uuid(),
  region public.app_region not null,
  store_id uuid not null references public.stores(id),
  responsible_id uuid not null references public.store_responsibles(id),
  audit_team_id uuid not null references public.audit_teams(id),
  visit_type_id uuid not null references public.visit_types(id),
  created_by uuid not null references public.profiles(id),
  status public.visit_status not null default 'draft',
  general_observations text,
  obtained_score numeric(10,2) not null default 0,
  max_score numeric(10,2) not null default 0,
  compliance_percent numeric(5,2) not null default 0,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finalized_requires_timestamp check (status <> 'finalized' or finalized_at is not null)
);

create table public.audit_answers (
  id uuid primary key default gen_random_uuid(),
  region public.app_region not null,
  report_id uuid not null references public.audit_reports(id) on delete cascade,
  question_id uuid not null references public.checklist_questions(id),
  answer public.answer_value not null,
  observation text not null check (length(trim(observation)) > 0),
  obtained_score numeric(8,2) not null check (obtained_score >= 0),
  max_score numeric(8,2) not null check (max_score > 0),
  created_at timestamptz not null default now(),
  unique (report_id, question_id)
);

create table public.audit_evidence (
  id uuid primary key default gen_random_uuid(),
  region public.app_region not null,
  report_id uuid not null references public.audit_reports(id) on delete cascade,
  question_id uuid references public.checklist_questions(id),
  storage_bucket text not null default 'audit-evidence',
  storage_path text not null,
  mime_type text not null,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create table public.audit_signatures (
  id uuid primary key default gen_random_uuid(),
  region public.app_region not null,
  report_id uuid not null references public.audit_reports(id) on delete cascade,
  kind public.signature_kind not null,
  signer_name text not null,
  storage_bucket text not null default 'audit-signatures',
  storage_path text not null,
  sha256 text,
  created_at timestamptz not null default now(),
  unique (report_id, kind),
  unique (storage_bucket, storage_path)
);

create table public.report_notifications (
  id uuid primary key default gen_random_uuid(),
  region public.app_region not null,
  report_id uuid not null references public.audit_reports(id) on delete cascade,
  recipient_email text not null,
  sent_at timestamptz,
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now()
);

create or replace function public.current_profile_region()
returns public.app_region
language sql
stable
security invoker
as $$
  select region from public.profiles where id = auth.uid() and is_active = true
$$;

create or replace function public.current_profile_role()
returns public.app_role
language sql
stable
security invoker
as $$
  select role from public.profiles where id = auth.uid() and is_active = true
$$;

create or replace function public.can_access_region(target_region public.app_region)
returns boolean
language sql
stable
security invoker
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and (p.role = 'super_admin' or p.region = target_region)
  )
$$;

create or replace function public.is_region_admin_for(target_region public.app_region)
returns boolean
language sql
stable
security invoker
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and (p.role = 'super_admin' or (p.role = 'regional_admin' and p.region = target_region))
  )
$$;

create or replace function public.is_vip_for(target_region public.app_region)
returns boolean
language sql
stable
security invoker
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and (p.role = 'super_admin' or (p.role in ('vip', 'regional_admin') and p.region = target_region))
  )
$$;

alter table public.profiles enable row level security;
alter table public.invitations enable row level security;
alter table public.corporate_email_domains enable row level security;
alter table public.stores enable row level security;
alter table public.store_responsibles enable row level security;
alter table public.audit_teams enable row level security;
alter table public.audit_team_members enable row level security;
alter table public.visit_types enable row level security;
alter table public.checklist_questions enable row level security;
alter table public.audit_reports enable row level security;
alter table public.audit_answers enable row level security;
alter table public.audit_evidence enable row level security;
alter table public.audit_signatures enable row level security;
alter table public.report_notifications enable row level security;

create policy "profiles_select_same_region" on public.profiles for select to authenticated using (public.can_access_region(region));
create policy "profiles_update_self" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and region = public.current_profile_region());
create policy "invitations_admin_all" on public.invitations for all to authenticated using (public.is_region_admin_for(region)) with check (public.is_region_admin_for(region));
create policy "stores_read_same_region" on public.stores for select to authenticated using (public.can_access_region(region));
create policy "stores_admin_write" on public.stores for all to authenticated using (public.is_region_admin_for(region)) with check (public.is_region_admin_for(region));
create policy "responsibles_read_same_region" on public.store_responsibles for select to authenticated using (public.can_access_region(region));
create policy "responsibles_admin_write" on public.store_responsibles for all to authenticated using (public.is_region_admin_for(region)) with check (public.is_region_admin_for(region));
create policy "teams_read_same_region" on public.audit_teams for select to authenticated using (public.can_access_region(region));
create policy "teams_admin_write" on public.audit_teams for all to authenticated using (public.is_region_admin_for(region)) with check (public.is_region_admin_for(region));
create policy "visit_types_read_same_region" on public.visit_types for select to authenticated using (public.can_access_region(region));
create policy "visit_types_admin_write" on public.visit_types for all to authenticated using (public.is_region_admin_for(region)) with check (public.is_region_admin_for(region));
create policy "questions_read_same_region" on public.checklist_questions for select to authenticated using (public.can_access_region(region));
create policy "questions_admin_write" on public.checklist_questions for all to authenticated using (public.is_region_admin_for(region)) with check (public.is_region_admin_for(region));
create policy "reports_read_same_region" on public.audit_reports for select to authenticated using (public.can_access_region(region));
create policy "reports_insert_same_region" on public.audit_reports for insert to authenticated with check (created_by = auth.uid() and public.can_access_region(region));
create policy "reports_update_draft_same_region" on public.audit_reports for update to authenticated using (public.can_access_region(region) and status = 'draft') with check (public.can_access_region(region));
create policy "answers_read_same_region" on public.audit_answers for select to authenticated using (public.can_access_region(region));
create policy "answers_write_draft_same_region" on public.audit_answers for all to authenticated using (public.can_access_region(region)) with check (public.can_access_region(region));
create policy "evidence_read_same_region" on public.audit_evidence for select to authenticated using (public.can_access_region(region));
create policy "evidence_insert_same_region" on public.audit_evidence for insert to authenticated with check (uploaded_by = auth.uid() and public.can_access_region(region));
create policy "signatures_read_same_region" on public.audit_signatures for select to authenticated using (public.can_access_region(region));
create policy "signatures_insert_same_region" on public.audit_signatures for insert to authenticated with check (public.can_access_region(region));
create policy "notifications_read_same_region" on public.report_notifications for select to authenticated using (public.is_vip_for(region));

create index profiles_region_role_idx on public.profiles(region, role);
create index stores_region_active_idx on public.stores(region, is_active);
create index questions_region_visit_type_idx on public.checklist_questions(region, visit_type_id, is_active, display_order);
create index reports_region_store_created_idx on public.audit_reports(region, store_id, created_at desc);
create index answers_report_idx on public.audit_answers(report_id);
create index evidence_report_idx on public.audit_evidence(report_id);
create index signatures_report_idx on public.audit_signatures(report_id);
