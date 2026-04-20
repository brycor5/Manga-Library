-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 003: Release watchlist & notifications
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable pg_net if not already enabled (needed for pg_cron → Edge Function calls)
create extension if not exists pg_net;

-- ─────────────────────────────────────────
-- RELEASE_WATCHLIST
-- One row per series the user wants release alerts for.
-- ─────────────────────────────────────────
create table if not exists release_watchlist (
  id              uuid primary key default gen_random_uuid(),
  series_id       uuid not null references series(id) on delete cascade,
  mu_series_id    bigint,          -- MangaUpdates series ID, cached on first add
  notify_inapp    boolean not null default true,
  notify_push     boolean not null default false,
  notify_email    boolean not null default false,
  created_at      timestamptz default now(),
  unique (series_id)
);

alter table release_watchlist enable row level security;
create policy "Allow all on release_watchlist" on release_watchlist
  for all using (true) with check (true);

-- ─────────────────────────────────────────
-- NOTIFICATIONS
-- One row per detected upcoming release event.
-- ─────────────────────────────────────────
create table if not exists notifications (
  id              uuid primary key default gen_random_uuid(),
  series_id       uuid not null references series(id) on delete cascade,
  volume_label    text not null,   -- e.g. "Volume 14"
  release_date    date,
  read_at         timestamptz,     -- null = unread
  buy_links       jsonb default '{}',  -- { amazon, bn, crunchyroll }
  created_at      timestamptz default now()
);

create index if not exists notifications_series_id_idx on notifications(series_id);
create index if not exists notifications_unread_idx    on notifications(read_at) where read_at is null;

-- Prevent duplicate notifications for same series + volume
create unique index if not exists notifications_series_volume_unique
  on notifications(series_id, volume_label);

alter table notifications enable row level security;
create policy "Allow all on notifications" on notifications
  for all using (true) with check (true);

-- ─────────────────────────────────────────
-- PUSH_SUBSCRIPTIONS  (Phase 2 — browser push opt-in)
-- ─────────────────────────────────────────
create table if not exists push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz default now()
);

alter table push_subscriptions enable row level security;
create policy "Allow all on push_subscriptions" on push_subscriptions
  for all using (true) with check (true);

-- ─────────────────────────────────────────
-- pg_cron daily schedule (uncomment after deploying the Edge Function)
-- Fires check-releases every day at 9 AM UTC.
-- Replace <YOUR_SERVICE_ROLE_KEY> with your actual key.
-- ─────────────────────────────────────────
-- select cron.schedule(
--   'check-manga-releases',
--   '0 9 * * *',
--   $$
--     select net.http_post(
--       url     := (select value from app_config where key = 'supabase_url') || '/functions/v1/check-releases',
--       headers := jsonb_build_object(
--         'Content-Type',  'application/json',
--         'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'
--       ),
--       body    := '{}'::jsonb
--     )
--   $$
-- );
