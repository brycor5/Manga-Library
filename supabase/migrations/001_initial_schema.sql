-- Manga Library — Initial Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────
-- SERIES table
-- ─────────────────────────────────────────
create table if not exists series (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  author         text,
  artist         text,
  publisher      text,
  original_publisher text,
  demographic    text,
  genre          text[] default '{}',
  total_volumes  integer,
  total_pages    integer,
  status         text default 'Unknown',
  language       text default 'English',
  format         text default 'Single',
  isbn           text,
  upc            text,
  msrp           numeric(8,2),
  cover_image_url text,
  description    text,
  mal_id         integer unique,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- ─────────────────────────────────────────
-- COLLECTION_ENTRIES table
-- ─────────────────────────────────────────
create table if not exists collection_entries (
  id                        uuid primary key default gen_random_uuid(),
  series_id                 uuid not null references series(id) on delete cascade,
  volumes_owned             integer not null default 0,
  volumes_read              integer not null default 0,
  reading_status            text not null default 'Plan to Read',
  rating                    integer check (rating >= 1 and rating <= 10),
  notes                     text,
  date_added                date not null default current_date,
  wishlist                  boolean not null default false,
  is_complete_in_collection boolean not null default false,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

-- Prevent duplicate series in collection
create unique index if not exists collection_entries_series_id_unique
  on collection_entries(series_id);

-- ─────────────────────────────────────────
-- Auto-update updated_at
-- ─────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger series_updated_at
  before update on series
  for each row execute function update_updated_at();

create trigger collection_entries_updated_at
  before update on collection_entries
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────
-- Row Level Security (open for now — add auth later)
-- ─────────────────────────────────────────
alter table series enable row level security;
alter table collection_entries enable row level security;

-- Allow all operations from the anon key for personal use
create policy "Allow all on series" on series
  for all using (true) with check (true);

create policy "Allow all on collection_entries" on collection_entries
  for all using (true) with check (true);
