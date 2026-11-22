Inventori Barang + Supabase
===========================

Langkah setup
1. Buat project di https://supabase.com (gratis).
2. Buka SQL Editor, tempel isi schema.sql, lalu klik Run.
   Ini membuat tabel "barang" dan aturan keamanan (RLS) agar tiap pengguna
   hanya bisa mengakses datanya sendiri.
3. Buka Project Settings > API, salin "Project URL" dan "anon public key",
   lalu tempel ke config.js.
4. (Opsional) Authentication > Providers > Email: matikan "Confirm email"
   jika ingin langsung masuk setelah daftar saat pengembangan.
5. Buka index.html di browser. Jika ada kendala, jalankan lewat server lokal,
   misalnya: npx serve   atau ekstensi Live Server di VS Code.

Isi
- index.html : halaman login, daftar, dan tabel inventori
- style.css  : tampilan (mode terang dan gelap)
- app.js     : logika aplikasi (Supabase Auth + CRUD tabel barang)
- config.js  : URL dan anon key Supabase
- schema.sql : tabel dan kebijakan RLS

Keamanan
- anon key aman ditaruh di sisi browser karena data dilindungi RLS.
- Jangan pernah memasukkan service_role key ke file apa pun di proyek ini.

Fitur dashboard dan transaksi (v2)
- Setelah schema.sql, jalankan juga schema-transaksi.sql di SQL Editor Supabase.
  File ini membuat tabel "transaksi" dan fungsi catat_transaksi (stok ikut berubah otomatis).
- Menu: Dashboard (ringkasan, grafik 7 hari, stok menipis, transaksi terbaru),
  Barang (kelola barang), Transaksi (riwayat dan pencatatan stok masuk/keluar).
- Tombol + dan - di tabel Barang kini juga tercatat sebagai transaksi.

Pencatatan otomatis
- Barang baru dengan stok > 0 tercatat sebagai transaksi masuk ("Stok awal").
- Mengubah angka stok lewat tombol Ubah tercatat sebagai transaksi masuk/keluar sebesar selisihnya.
- Tombol + dan - serta menu Catat transaksi juga tercatat.

Cetak laporan dan struk
- Menu Transaksi > "Cetak laporan": mencetak daftar transaksi sesuai filter jenis dan rentang tanggal (A4).
- Tombol "Struk" di tiap baris: mencetak struk satu transaksi (lebar 80 mm).
- Untuk PDF, pada jendela cetak pilih printer "Save as PDF" / "Simpan sebagai PDF".

Transaksi per hari
- Menu Transaksi: centang "Per hari" untuk mengelompokkan transaksi per tanggal
  (dengan subtotal masuk, keluar, dan jumlah transaksi tiap hari).
- Tombol "Hari ini" memfilter transaksi hari ini; klik lagi untuk menghapus filter.
- Laporan cetak juga mengikuti pengelompokan per hari.
