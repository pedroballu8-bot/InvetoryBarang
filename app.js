(function(){
  var cfg = window.APP_CONFIG || {};
  var configured = !!(window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    cfg.SUPABASE_URL.indexOf("GANTI") < 0 && cfg.SUPABASE_ANON_KEY.indexOf("GANTI") < 0);
  var db = configured ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  var NOT_CONFIGURED = "Supabase belum dikonfigurasi. Isi URL dan anon key di config.js.";

  var items = [], trx = [];
  var editId = null;
  var sort = { key: "nama", dir: 1 };

  var $ = function(id){ return document.getElementById(id); };
  var rupiah = function(n){ return "Rp" + Math.round(n).toLocaleString("id-ID"); };

  function fromRow(r){
    return { id: r.id, nama: r.nama, sku: r.sku || "", kategori: r.kategori || "",
             harga: Number(r.harga) || 0, stok: r.stok, min: r.min_stok };
  }
  function toRow(d){
    return { nama: d.nama, sku: d.sku, kategori: d.kategori, harga: d.harga, stok: d.stok, min_stok: d.min };
  }
  function status(it){
    if (it.stok <= 0) return "out";
    if (it.stok <= it.min) return "low";
    return "ok";
  }

  var toastTimer;
  function toast(msg){
    var t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function(){ t.classList.remove("show"); }, 2400);
  }
  function esc(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c];
    });
  }

  // ===== Data (Supabase) =====
  function loadItems(){
    return Promise.all([
      db.from("barang").select("*").order("nama"),
      db.from("transaksi").select("*").order("created_at", { ascending: false }).limit(500)
    ]).then(function(r){
      if (r[0].error) { toast("Gagal memuat barang: " + r[0].error.message); items = []; }
      else items = r[0].data.map(fromRow);
      if (r[1].error) { toast("Gagal memuat transaksi. Sudah menjalankan schema-transaksi.sql?"); trx = []; }
      else trx = r[1].data;
      render();
    });
  }

  // ===== Tampilan =====
  function render(){
    var unit = 0, nilai = 0, low = 0;
    items.forEach(function(it){
      unit += it.stok; nilai += it.stok * it.harga;
      if (status(it) !== "ok") low++;
    });
    $("sJenis").textContent = items.length;
    $("sUnit").textContent = unit.toLocaleString("id-ID");
    $("sNilai").textContent = rupiah(nilai);
    $("sLow").textContent = low;
    $("sLowBox").classList.toggle("alert", low > 0);

    var kats = Array.from(new Set(items.map(function(i){ return i.kategori; }).filter(Boolean))).sort();
    var cur = $("fKat").value;
    $("fKat").innerHTML = '<option value="">Semua kategori</option>' +
      kats.map(function(k){ return '<option value="' + esc(k) + '">' + esc(k) + '</option>'; }).join("");
    $("fKat").value = kats.indexOf(cur) >= 0 ? cur : "";
    $("katList").innerHTML = kats.map(function(k){ return '<option value="' + esc(k) + '">'; }).join("");

    var q = $("q").value.trim().toLowerCase();
    var fk = $("fKat").value, fs = $("fStatus").value;
    var list = items.filter(function(it){
      if (q && (it.nama + " " + it.sku).toLowerCase().indexOf(q) < 0) return false;
      if (fk && it.kategori !== fk) return false;
      if (fs === "low" && status(it) !== "low") return false;
      if (fs === "out" && status(it) !== "out") return false;
      return true;
    });
    list.sort(function(a, b){
      var x = a[sort.key], y = b[sort.key];
      if (typeof x === "string") return x.localeCompare(y, "id") * sort.dir;
      return (x - y) * sort.dir;
    });

    var labels = { ok: "Aman", low: "Menipis", out: "Habis" };
    $("rows").innerHTML = list.map(function(it){
      var st = status(it);
      return '<tr>' +
        '<td><div class="name">' + esc(it.nama) + '</div><div class="sku">' + esc(it.sku || "Tanpa kode") + '</div></td>' +
        '<td>' + esc(it.kategori || "-") + '</td>' +
        '<td class="num">' + rupiah(it.harga) + '</td>' +
        '<td class="num"><span class="qty">' +
          '<button data-act="out" data-id="' + it.id + '" aria-label="Kurangi stok ' + esc(it.nama) + '">−</button>' +
          '<strong>' + it.stok + '</strong>' +
          '<button data-act="in" data-id="' + it.id + '" aria-label="Tambah stok ' + esc(it.nama) + '">+</button>' +
        '</span></td>' +
        '<td><span class="badge ' + st + '">' + labels[st] + '</span></td>' +
        '<td><div class="row-actions">' +
          '<button data-act="edit" data-id="' + it.id + '">Ubah</button>' +
          '<button class="danger" data-act="del" data-id="' + it.id + '">Hapus</button>' +
        '</div></td></tr>';
    }).join("");
    $("empty").hidden = list.length > 0;
    renderExtra();
  }

  function openForm(it){
    editId = it ? it.id : null;
    $("dlgTitle").textContent = it ? "Ubah barang" : "Tambah barang";
    $("fNama").value = it ? it.nama : "";
    $("fSku").value = it ? it.sku : "";
    $("fKategori").value = it ? it.kategori : "";
    $("fHarga").value = it ? it.harga : 0;
    $("fStok").value = it ? it.stok : 0;
    $("fMin").value = it ? it.min : 5;
    $("dlg").showModal();
    $("fNama").focus();
  }

  $("btnAdd").addEventListener("click", function(){ openForm(null); });
  $("btnCancel").addEventListener("click", function(){ $("dlg").close(); });

  $("form").addEventListener("submit", function(e){
    e.preventDefault();
    var data = {
      nama: $("fNama").value.trim(),
      sku: $("fSku").value.trim(),
      kategori: $("fKategori").value.trim(),
      harga: Math.max(0, parseFloat($("fHarga").value) || 0),
      stok: Math.max(0, parseInt($("fStok").value, 10) || 0),
      min: Math.max(0, parseInt($("fMin").value, 10) || 0)
    };
    if (!data.nama) return;
    var wasEdit = editId;
    var target = data.stok;
    var base = toRow(data);
    var old = wasEdit ? items.find(function(x){ return x.id === wasEdit; }) : null;
    base.stok = old ? old.stok : 0;
    var req = wasEdit
      ? db.from("barang").update(base).eq("id", wasEdit).select().single()
      : db.from("barang").insert(base).select().single();
    req.then(function(res){
      if (res.error) { toast("Gagal menyimpan: " + res.error.message); return; }
      var delta = target - res.data.stok;
      var next = delta === 0 ? Promise.resolve({ error: null }) : db.rpc("catat_transaksi", {
        p_barang: res.data.id,
        p_jenis: delta > 0 ? "masuk" : "keluar",
        p_jumlah: Math.abs(delta),
        p_catatan: wasEdit ? "Penyesuaian lewat ubah barang" : "Stok awal"
      });
      return next.then(function(r2){
        if (r2.error) toast("Barang tersimpan, tetapi stok gagal dicatat: " + r2.error.message);
        else toast(wasEdit ? "Perubahan disimpan" : "Barang ditambahkan");
        $("dlg").close();
        return loadItems();
      });
    });
  });

  $("rows").addEventListener("click", function(e){
    var b = e.target.closest("button[data-act]");
    if (!b) return;
    var it = items.find(function(x){ return x.id === b.dataset.id; });
    if (!it) return;
    var act = b.dataset.act;
    if (act === "edit") { openForm(it); return; }
    if (act === "in" || act === "out") {
      var n = act === "in" ? it.stok + 1 : it.stok - 1;
      if (n < 0) { toast("Stok sudah 0"); return; }
      db.rpc("catat_transaksi", { p_barang: it.id, p_jenis: act === "in" ? "masuk" : "keluar", p_jumlah: 1, p_catatan: "Penyesuaian cepat" }).then(function(res){
        if (res.error) { toast("Gagal memperbarui stok: " + res.error.message); return; }
        loadItems();
      });
    } else if (act === "del") {
      if (!confirm("Hapus “" + it.nama + "” dari inventori?")) return;
      db.from("barang").delete().eq("id", it.id).then(function(res){
        if (res.error) { toast("Gagal menghapus: " + res.error.message); return; }
        items = items.filter(function(x){ return x.id !== it.id; });
        toast("Barang dihapus"); render();
      });
    }
  });

  ["q", "fKat", "fStatus"].forEach(function(id){ $(id).addEventListener("input", render); });
  document.querySelectorAll("th button[data-sort]").forEach(function(b){
    b.addEventListener("click", function(){
      var k = b.dataset.sort;
      sort.dir = sort.key === k ? -sort.dir : 1;
      sort.key = k;
      render();
    });
  });

  // ===== Dashboard dan transaksi =====
  function fmtTgl(d){
    return new Date(d).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }
  function namaBarang(id){
    var it = items.find(function(x){ return x.id === id; });
    return it ? it.nama : "Barang dihapus";
  }
  function renderExtra(){
    var low = items.filter(function(i){ return status(i) !== "ok"; })
      .sort(function(a, b){ return a.stok - b.stok; }).slice(0, 6);
    $("lowList").innerHTML = low.length ? low.map(function(i){
      return '<li><span>' + esc(i.nama) + '</span><span class="badge ' + status(i) + '">' + i.stok + ' tersisa</span></li>';
    }).join("") : '<li class="muted">Semua stok aman.</li>';

    $("recent").innerHTML = trx.length ? trx.slice(0, 6).map(function(t){
      return '<li><span>' + esc(namaBarang(t.barang_id)) + '<small>' + fmtTgl(t.created_at) + '</small></span>' +
        '<b class="' + t.jenis + '">' + (t.jenis === "masuk" ? "+" : "−") + t.jumlah + '</b></li>';
    }).join("") : '<li class="muted">Belum ada transaksi.</li>';

    var days = [], i;
    for (i = 6; i >= 0; i--) {
      var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      days.push({ d: d, masuk: 0, keluar: 0 });
    }
    trx.forEach(function(t){
      var td = new Date(t.created_at); td.setHours(0, 0, 0, 0);
      var day = days.find(function(x){ return x.d.getTime() === td.getTime(); });
      if (day) day[t.jenis] += t.jumlah;
    });
    var max = Math.max.apply(null, days.map(function(x){ return Math.max(x.masuk, x.keluar); }).concat([1]));
    $("chart").innerHTML = days.map(function(x){
      return '<div class="col"><div class="bars">' +
        '<i class="k masuk" style="height:' + (x.masuk / max * 100) + '%" title="Masuk ' + x.masuk + '"></i>' +
        '<i class="k keluar" style="height:' + (x.keluar / max * 100) + '%" title="Keluar ' + x.keluar + '"></i>' +
        '</div><small>' + x.d.toLocaleDateString("id-ID", { weekday: "short" }) + '</small></div>';
    }).join("");

    var tj = $("tJenis").value;
    var list = trx.filter(function(t){ return !tj || t.jenis === tj; });
    $("trxRows").innerHTML = list.map(function(t){
      return '<tr><td>' + fmtTgl(t.created_at) + '</td><td class="name">' + esc(namaBarang(t.barang_id)) + '</td>' +
        '<td><span class="badge ' + (t.jenis === "keluar" ? "low" : "") + '">' + (t.jenis === "masuk" ? "Masuk" : "Keluar") + '</span></td>' +
        '<td class="num">' + t.jumlah + '</td><td>' + esc(t.catatan || "-") + '</td></tr>';
    }).join("");
    $("trxEmpty").textContent = trx.length
      ? "Tidak ada transaksi dengan jenis ini. Ubah filter ke “Semua jenis”."
      : "Belum ada transaksi. Klik “Catat transaksi” untuk mencatat stok masuk atau keluar.";
    $("trxEmpty").hidden = list.length > 0;
  }

  function setView(v){
    [["dash", "viewDash"], ["barang", "viewBarang"], ["trx", "viewTrx"]].forEach(function(p){
      $(p[1]).hidden = p[0] !== v;
    });
    document.querySelectorAll(".nav button").forEach(function(b){
      b.setAttribute("aria-selected", b.dataset.view === v);
    });
  }
  document.querySelectorAll(".nav button").forEach(function(b){
    b.addEventListener("click", function(){ setView(b.dataset.view); });
  });

  $("tJenis").addEventListener("input", render);
  $("btnTrx").addEventListener("click", function(){
    if (!items.length) { toast("Tambah barang dulu sebelum mencatat transaksi."); return; }
    $("tBarang").innerHTML = items.slice().sort(function(a, b){ return a.nama.localeCompare(b.nama, "id"); })
      .map(function(i){ return '<option value="' + i.id + '">' + esc(i.nama) + ' (stok ' + i.stok + ')</option>'; }).join("");
    $("tJns").value = "masuk"; $("tJml").value = 1; $("tCat").value = ""; $("tErr").textContent = "";
    $("dlgT").showModal();
  });
  $("btnCancelT").addEventListener("click", function(){ $("dlgT").close(); });
  $("formT").addEventListener("submit", function(e){
    e.preventDefault();
    var jml = parseInt($("tJml").value, 10) || 0;
    if (jml < 1) { $("tErr").textContent = "Jumlah minimal 1."; return; }
    db.rpc("catat_transaksi", { p_barang: $("tBarang").value, p_jenis: $("tJns").value, p_jumlah: jml, p_catatan: $("tCat").value.trim() })
      .then(function(res){
        if (res.error) {
          $("tErr").textContent = /check|stok/i.test(res.error.message) ? "Stok tidak cukup untuk transaksi keluar ini." : res.error.message;
          return;
        }
        $("dlgT").close(); toast("Transaksi dicatat"); loadItems();
      });
  });

  // ===== Autentikasi (Supabase Auth) =====
  function showTab(which){
    var isLogin = which === "login";
    $("loginForm").hidden = !isLogin;
    $("regForm").hidden = isLogin;
    $("tabLogin").setAttribute("aria-selected", isLogin);
    $("tabReg").setAttribute("aria-selected", !isLogin);
    $("lErr").textContent = ""; $("rErr").textContent = "";
  }
  $("tabLogin").addEventListener("click", function(){ showTab("login"); });
  $("tabReg").addEventListener("click", function(){ showTab("reg"); });

  function startApp(user){
    var meta = user.user_metadata || {};
    $("userLabel").textContent = "Halo, " + (meta.nama || user.email);
    $("auth").hidden = true;
    $("app").hidden = false;
    setView("dash");
    loadItems();
  }

  $("btnLogout").addEventListener("click", function(){
    db.auth.signOut().then(function(){
      items = [];
      if ($("dlg").open) $("dlg").close();
      $("app").hidden = true;
      $("auth").hidden = false;
      $("loginForm").reset(); $("regForm").reset();
      showTab("login");
      $("lUser").focus();
    });
  });

  $("regForm").addEventListener("submit", function(e){
    e.preventDefault();
    var err = $("rErr");
    if (!db) { err.textContent = NOT_CONFIGURED; return; }
    var nama = $("rNama").value.trim();
    var email = $("rUser").value.trim();
    var pass = $("rPass").value;
    if (pass.length < 6) { err.textContent = "Kata sandi minimal 6 karakter."; return; }
    if (pass !== $("rPass2").value) { err.textContent = "Kata sandi dan pengulangannya belum sama."; return; }
    err.textContent = "Membuat akun...";
    db.auth.signUp({ email: email, password: pass, options: { data: { nama: nama } } }).then(function(res){
      if (res.error) { err.textContent = res.error.message; return; }
      if (res.data.session) { err.textContent = ""; startApp(res.data.user); toast("Akun berhasil dibuat"); }
      else { err.textContent = "Akun dibuat. Cek email untuk konfirmasi, lalu masuk."; }
    });
  });

  $("loginForm").addEventListener("submit", function(e){
    e.preventDefault();
    var err = $("lErr");
    if (!db) { err.textContent = NOT_CONFIGURED; return; }
    err.textContent = "Memeriksa...";
    db.auth.signInWithPassword({ email: $("lUser").value.trim(), password: $("lPass").value }).then(function(res){
      if (res.error) {
        err.textContent = /confirm/i.test(res.error.message)
          ? "Email belum dikonfirmasi. Cek kotak masuk emailmu."
          : "Email atau kata sandi salah.";
        return;
      }
      err.textContent = "";
      startApp(res.data.user);
    });
  });

  if (!db) { $("lErr").textContent = NOT_CONFIGURED; }
  else {
    db.auth.getSession().then(function(r){
      if (r.data && r.data.session) startApp(r.data.session.user);
    });
  }
})();
