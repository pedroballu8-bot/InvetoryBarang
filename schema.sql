-- Jalankan di Supabase: SQL Editor > New query > Run

create table public.barang (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nama text not null,
  sku text not null default '',
  kategori text not null default '',
  harga numeric(14,2) not null default 0 check (harga >= 0),
  stok integer not null default 0 check (stok >= 0),
  min_stok integer not null default 5 check (min_stok >= 0),
  created_at timestamptz not null default now()
);

create index barang_user_id_idx on public.barang (user_id);

-- Row Level Security: setiap pengguna hanya bisa melihat dan mengubah barang miliknya
alter table public.barang enable row level security;

create policy "barang_select_own" on public.barang
  for select to authenticated using (user_id = auth.uid());

create policy "barang_insert_own" on public.barang
  for insert to authenticated with check (user_id = auth.uid());

create policy "barang_update_own" on public.barang
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "barang_delete_own" on public.barang
  for delete to authenticated using (user_id = auth.uid());
