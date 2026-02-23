create table if not exists public.waitlist_submissions (
  id bigserial primary key,
  email text not null,
  phone text,
  consent boolean not null default false,
  source text not null default 'waitlist-web',
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create unique index if not exists waitlist_email_unique_ci
  on public.waitlist_submissions (lower(email));

create index if not exists waitlist_ip_hash_created_at_idx
  on public.waitlist_submissions (ip_hash, created_at desc);

alter table public.waitlist_submissions enable row level security;

-- No RLS policies are created intentionally.
-- Writes happen only through the server-side Vercel function using service role key.
