-- Run in a NEW dedicated Supabase project or review naming conflicts before applying.
create extension if not exists pgcrypto;
create table if not exists public.crm_members(user_id uuid primary key references auth.users(id) on delete cascade, role text not null default 'agent' check(role in ('admin','agent')), created_at timestamptz default now());
create table if not exists public.crm_leads(id uuid primary key default gen_random_uuid(),name text not null default '',phone text not null unique,source text default 'whatsapp',stage text not null default 'new' check(stage in ('new','contacted','interested','registered','trial','won','lost')),owner_name text default 'Manuella',first_contact_at timestamptz,registered_at timestamptz,autoprime_user_id text unique,asaas_customer_id text,notes text,human_takeover boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.crm_messages(id uuid primary key default gen_random_uuid(),lead_id uuid not null references public.crm_leads(id) on delete cascade,external_id text unique,direction text not null check(direction in ('in','out')),body text,status text default 'received',sent_at timestamptz not null default now(),created_at timestamptz not null default now());
create index if not exists crm_messages_lead_idx on public.crm_messages(lead_id,sent_at);
create table if not exists public.crm_followups(id uuid primary key default gen_random_uuid(),lead_id uuid not null references public.crm_leads(id) on delete cascade,due_at timestamptz not null,status text not null default 'pending' check(status in ('pending','done','cancelled')),note text,completed_at timestamptz,created_at timestamptz not null default now());
create index if not exists crm_followups_due_idx on public.crm_followups(status,due_at);
create table if not exists public.crm_subscriptions(id uuid primary key default gen_random_uuid(),lead_id uuid references public.crm_leads(id) on delete set null,asaas_subscription_id text unique,asaas_customer_id text,plan_name text,status text not null default 'pending',amount numeric(12,2),first_paid_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.crm_payment_events(id text primary key,asaas_subscription_id text,asaas_payment_id text,event_type text not null,raw jsonb,received_at timestamptz default now());
create table if not exists public.crm_integrations_events(id uuid primary key default gen_random_uuid(),external_key text unique,provider text not null,event_type text,payload jsonb,created_at timestamptz default now());
-- Users must be manually approved as CRM members by a trusted administrator.
create or replace function public.crm_is_member() returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.crm_members where user_id=(select auth.uid())) $$;
create or replace function public.crm_is_admin() returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.crm_members where user_id=(select auth.uid()) and role='admin') $$;
revoke all on function public.crm_is_member() from public,anon;
revoke all on function public.crm_is_admin() from public,anon;
grant execute on function public.crm_is_member() to authenticated;
grant execute on function public.crm_is_admin() to authenticated;
alter table public.crm_members enable row level security;
alter table public.crm_leads enable row level security;
alter table public.crm_messages enable row level security;
alter table public.crm_followups enable row level security;
alter table public.crm_subscriptions enable row level security;
alter table public.crm_payment_events enable row level security;
alter table public.crm_integrations_events enable row level security;
create policy "members read themselves" on public.crm_members for select to authenticated using(user_id=(select auth.uid()));
create policy "members read leads" on public.crm_leads for select to authenticated using(public.crm_is_member());
create policy "members insert leads" on public.crm_leads for insert to authenticated with check(public.crm_is_member());
create policy "members update leads" on public.crm_leads for update to authenticated using(public.crm_is_member()) with check(public.crm_is_member());
create policy "members read messages" on public.crm_messages for select to authenticated using(public.crm_is_member());
-- Messages are written by a trusted backend only, never inserted by the browser.
create policy "members read followups" on public.crm_followups for select to authenticated using(public.crm_is_member());
create policy "members insert followups" on public.crm_followups for insert to authenticated with check(public.crm_is_member());
create policy "members update followups" on public.crm_followups for update to authenticated using(public.crm_is_member()) with check(public.crm_is_member());
create policy "members read subscriptions" on public.crm_subscriptions for select to authenticated using(public.crm_is_member());
-- Server-side integration writes use service_role; store secrets ONLY on backend.
do $$begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='crm_leads') then alter publication supabase_realtime add table public.crm_leads; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='crm_messages') then alter publication supabase_realtime add table public.crm_messages; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='crm_followups') then alter publication supabase_realtime add table public.crm_followups; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='crm_subscriptions') then alter publication supabase_realtime add table public.crm_subscriptions; end if;
end$$;
