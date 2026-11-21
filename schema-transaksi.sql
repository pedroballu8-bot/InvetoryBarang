-- Jalankan SETELAH schema.sql: SQL Editor > New query > Run

create table public.transaksi (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  barang_id uuid not null references public.barang(id) on delete cascade,
  jenis text not null check (jenis in ('masuk', 'keluar')),
  jumlah integer not null check (jumlah > 0),
  catatan text not null default '',
  created_at timestamptz not null default now()
);

create index transaksi_user_waktu_idx on public.transaksi (user_id, created_at desc);

alter table public.transaksi enable row level security;

create policy "transaksi_select_own" on public.transaksi
  for select to authenticated using (user_id = auth.uid());

create policy "transaksi_insert_own" on public.transaksi
  for insert to authenticated with check (user_id = auth.uid());

-- Mencatat transaksi sekaligus mengubah stok dalam satu langkah (atomik).
-- Stok keluar yang melebihi stok akan ditolak oleh aturan stok >= 0 di tabel barang.
create or replace function public.catat_transaksi(
  p_barang uuid, p_jenis text, p_jumlah integer, p_catatan text default ''
) returns void
language plpgsql security invoker set search_path = public
as $$
begin
  if p_jenis not in ('masuk', 'keluar') or p_jumlah < 1 then
    raise exception 'Data transaksi tidak valid';
  end if;
  update public.barang
     set stok = stok + case when p_jenis = 'masuk' then p_jumlah else -p_jumlah end
   where id = p_barang and user_id = auth.uid();
  if not found then
    raise exception 'Barang tidak ditemukan';
  end if;
  insert into public.transaksi (barang_id, jenis, jumlah, catatan)
  values (p_barang, p_jenis, p_jumlah, coalesce(p_catatan, ''));
end;
$$;

grant execute on function public.catat_transaksi(uuid, text, integer, text) to authenticated;
