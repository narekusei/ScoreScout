create type public.application_status as enum ('Saved', 'Applied', 'Interview', 'Won', 'Rejected');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.saved_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  opportunity_id text not null,
  title text not null,
  description text not null,
  source text not null,
  community text not null,
  url text not null,
  published_at timestamptz not null,
  budget_label text not null,
  tags jsonb not null default '[]'::jsonb,
  score integer not null check (score between 0 and 100),
  score_reasons jsonb not null default '[]'::jsonb,
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_opportunities_id_user_unique unique (id, user_id),
  constraint saved_opportunities_user_opportunity_unique unique (user_id, opportunity_id),
  constraint saved_opportunities_tags_array check (jsonb_typeof(tags) = 'array'),
  constraint saved_opportunities_score_reasons_array check (jsonb_typeof(score_reasons) = 'array')
);

create index saved_opportunities_user_saved_at_idx
  on public.saved_opportunities (user_id, saved_at desc);

create table public.application_statuses (
  saved_opportunity_id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  status public.application_status not null default 'Saved',
  updated_at timestamptz not null default now(),
  constraint application_statuses_saved_opportunity_user_fk
    foreign key (saved_opportunity_id, user_id)
    references public.saved_opportunities(id, user_id) on delete cascade
);

create index application_statuses_user_idx on public.application_statuses (user_id);

-- Access is denied until the authentication stage adds explicit ownership policies.
alter table public.users enable row level security;
alter table public.saved_opportunities enable row level security;
alter table public.application_statuses enable row level security;
