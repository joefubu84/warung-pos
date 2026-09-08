# 🍜 PANDUAN OPERASI & PENTADBIRAN SISTEM POS (ADMIN USER MANUAL)
> **Warung J&J — Sistem Tempat Jualan (POS) & Penghantaran Makanan**  
> *Lokasi: Jalan Penampang, 89500 Penampang, Sabah, Malaysia | Tel: 017-222 1784*  
> *Portal Rasmi: https://warungjnj.online | Versi: 2026 v2.4*

---

## 📌 Ringkasan Kandungan Manual Admin

| Modul | Tajuk Kandungan | Perkara Utama |
| :--- | :--- | :--- |
| **01** | **SOP Rutin Harian Warung** | Aliran kerja rutin pagi (buka kaunter wang apungan), waktu operasi harian, dan rutin malam (kiraan duit fizikal laci & tutup syif). |
| **02** | **Log Masuk & Keselamatan** | Maklumat URL rasmi (`/auth`), peranan pengguna (*Admin*, *Cashier*, *Chef*, *Rider*), dan perlindungan akaun. |
| **03** | **Pengurusan Daftar Wang Tunai** | Syarat ketat pembukaan kaunter sebelum jualan, rekod perbelanjaan laci (*Petty Cash*) beserta foto resit, semakan varians (lebihan/kurangan), pembukaan semula kecemasan (*Reopen*), dan eksport laporan harian terus ke WhatsApp pemilik. |
| **04** | **Kaunter POS & Pesanan** | Cara mengambil pesanan Makan Sini (*Dine-In*), Bungkus (*Takeaway*), pilihan varian/add-ons hidangan, bayaran Tunai & DuitNow QR, serta suis kawalan Buka/Tutup Pesanan Online. |
| **05** | **Sistem Paparan Dapur (KDS)** | Paparan tiket pesanan masa nyata, bunyi amaran loceng audio (Audio Beep Alert) bila pesanan baharu masuk, dan pertukaran status hidangan (*Pending ➔ Cooking ➔ Ready ➔ Served*). |
| **06** | **Pengurusan Meja & Kod QR** | Cara menjana dan mencetak kod QR setiap meja, imbasan layan diri pelanggan, dan notifikasi loceng buzzer panggil pelayan di kaunter. |
| **07** | **Menu, Harga & Stok Inventori** | Tambah menu baharu, kawalan stok fizikal, had amaran stok rendah (*Low Stock Threshold*), dan togol ketersediaan pantas (*Out of Stock*). |
| **08** | **Pesanan Penghantaran & Rider** | Formula jarak GPS automatik (RM 1.00/km, radius 15km, pesanan min RM 15.00), penugasan rider, dan bukti serahan (*Proof of Delivery / POD*). |
| **09** | **Dashboard & Analitik Jualan** | Pantau jumlah jualan harian, perbandingan prestasi semalam vs hari ini, dan carta menu paling laris. |
| **10** | **Jejak Audit (Audit Log)** | Rekod keselamatan tanpa padam bagi memantau sebarang suntingan harga, pemadaman perbelanjaan, atau pembatalan transaksi. |
| **11** | **Tetapan Pencetak Resit** | Konfigurasi saiz resit terma 58mm / 80mm dan ujian cetakan resit. |
| **12** | **Soalan Lazim & Kecemasan (FAQ)** | Tindakan jika talian internet terputus (sistem tetap berfungsi dengan *offline fallback*), semakan audio dapur, dan tips ketepatan tunai. |

---

## 01. SOP Rutin Harian Warung J&J

### ☀️ A. Rutin Pagi (Sebelum Mula Berniaga)
1. **Log Masuk ke Sistem:** Buka pelayar di tablet/laptop kaunter dan layari `https://warungjnj.online/auth`. Masukkan emel pentadbir dan kata laluan.
2. **Wajib Buka Kaunter Tunai (Cash Register Float):** Navigasi ke menu **Pengurusan Tunai (/cash-management)**. Tekan butang **"Buka Kaunter Sekarang"**, masukkan jumlah wang apungan (contoh: `RM 100.00`) dan sahkan.
3. **Buka Skrin Dapur (KDS) di Ruang Memasak:** Buka skrin dapur di `/kitchen` pada peranti dapur. Uji bunyi notifikasi (Beep Alert) dengan menekan skrin sekali untuk mengaktifkan kebenaran audio pelayar.
4. **Semak Ketersediaan Stok Menu:** Buka menu **Menu (/menu)**. Pastikan bahan yang kehabisan ditandakan sebagai *Habis Stok (Out of Stock)* supaya pelanggan tidak memesan item yang tidak tersedia.

### ☕ B. Rutin Waktu Operasi (Semasa Berniaga)
- **Mengambil Pesanan POS:** Pilih mod Makan Sini / Bungkus. Tambah menu & varian. Terima bayaran Tunai atau imbas DuitNow QR. Resit dicetak serta-merta.
- **Pantau Buzzer Meja:** Jika pelanggan menekan loceng panggil pelayan di meja mereka, loceng amaran akan berbunyi di kaunter bersama nombor meja.
- **Rekod Belanja Laci (Petty Cash):** Jika duit laci diambil untuk beli ais, sayur atau gas, rekodkan serta-merta di Pengurusan Tunai dan tangkap gambar resit.

### 🌙 C. Rutin Malam (Penutupan Kedai & Syif)
1. **Pastikan Semua Pesanan Dapur Selesai:** Pastikan tiada tiket pesanan yang masih terapung dalam status *Cooking* atau *Pending* di KDS.
2. **Kira Duit Tunai Sebenar di Dalam Laci Fizikal:** Buka laci tunai dan kira semua wang kertas serta syiling. Masukkan jumlah kiraan sebenar ke dalam borang **Tutup Kaunter** di `/cash-management`.
3. **Semak Varians (Lebihan / Kurangan):** Sistem akan membandingkan jumlah jangkaan (*Expected*) dengan jumlah kiraan sebenar. Jika ada perbezaan, wajib masukkan sebab pada ruangan nota.
4. **Tutup Kaunter & Kongsi Laporan WhatsApp:** Tekan butang **"Tutup Kaunter & Imbang Syif"**. Klik ikon WhatsApp untuk menghantar rumusan jualan harian terus kepada nombor telefon pemilik warung.

---

## 02. Log Masuk & Keselamatan Akaun

- **Pautan Portal:** `https://warungjnj.online/auth`
- **Akaun Rasmi:** `teststaffa@test.com` / `warungjnj2026`

| Peranan (Role) | Akses Dibenarkan | Sekatan |
| :--- | :--- | :--- |
| **Admin / Pemilik** | Akses penuh ke semua modul: Dashboard, POS, Kaunter Tunai, Tetapan, Menu, Audit Log, dan Laporan. | Tiada sekatan. |
| **Juruwang (Cashier)** | Buka/Tutup Kaunter, Ambil Pesanan POS, Pengurusan Meja, Cetak Resit, Rekod Perbelanjaan Kecil. | Tidak boleh mengubah tetapan kedai utama atau memadam log audit. |
| **Tukang Masak (Chef)** | Akses terus ke Skrin Dapur (KDS) di `/kitchen`, tandakan pesanan siap, kemas kini checklist dapur. | Tidak boleh mengakses data kutipan tunai atau dashboard jualan. |
| **Penghantar (Rider)** | Portal Rider di `/rider`, lihat senarai penghantaran yang ditugaskan, kemas kini POD. | Hanya melihat pesanan penghantaran milik sendiri. |

---

## 03. Pengurusan Daftar Wang Tunai (Cash Management)

### A. Tatacara Membuka Kaunter
1. Buka menu **Pengurusan Tunai** (`/cash-management`).
2. Tekan butang **"Buka Kaunter Sekarang"**.
3. Masukkan nilai wang apungan laci (contoh: `100.00`) dan tekan butang sahkan. Status kaunter akan bertukar hijau (**BUKA / AKTIF**).

### B. Merekod Perbelanjaan Laci Tunai (Petty Cash Drawer Expense)
1. Di halaman Pengurusan Tunai, tekan butang **"+ Rekod Perbelanjaan Laci"**.
2. Pilih Kategori Perbelanjaan (Bahan Basah / Ais / Minyak / Utiliti / Lain-lain).
3. Masukkan jumlah wang yang dikeluarkan (RM) dan keterangan ringkas.
4. Tangkap gambar atau muat naik foto resit sebagai bukti audit. Tekan **"Simpan Perbelanjaan"**.

### C. Penutupan Kaunter & Pengimbangan Syif
1. Di penghujung hari, klik butang **"Tutup Kaunter & Imbang Syif"**.
2. Formula sistem: `Baki Jangkaan = (Wang Apungan + Jualan Tunai) - Perbelanjaan Laci - Bayaran Balik`.
3. Taip jumlah wang tunai fizikal dalam laci ke medan **"Jumlah Tunai Sebenar Dikira (RM)"**.
4. Semak status varians:
   - **Padanan Sempurna (RM 0.00):** Warna hijau (Seimbang).
   - **Kurangan (-RM XX.XX):** Warna merah (Wajib masukkan nota penjelasan).
   - **Lebihan (+RM XX.XX):** Warna biru.
5. Tekan **"Sahkan & Tutup Kaunter"**. Laporan dikunci.

### D. Akses Pembukaan Semula Kecemasan (Emergency Reopen)
Jika ada pembetulan selepas tutup kaunter, Admin atau Juruwang Kanan boleh menekan butang **"Buka Semula Sesi Daftar Wang"** di bahagian atas kaunter POS dengan menyatakan sebab pembukaan semula.

---

## 04. Kaunter POS & Pengambilan Pesanan

1. **Pilih Jenis Pesanan:** Makan Sini (*Dine-In*), Bungkus (*Takeaway*), atau Penghantaran (*Delivery*).
2. **Pilih Menu & Ubah Varian:** Klik hidangan untuk memilih saiz, tahap pedas, atau *add-ons* (cth: tambah telur mata).
3. **Pilih Kaedah Bayaran:**
   - **Bayar Tunai:** Masukkan wang pelanggan untuk kalkulator baki automatik.
   - **DuitNow QR:** Paparkan kod QR akaun rasmi Warung J&J untuk imbasan pelanggan.
4. **Suis Pesanan Online (Buka / Tutup):**
   - 🟢 **Buka:** Pelanggan boleh memesan melalui QR meja dan delivery.
   - 🔴 **Tutup:** Jika dapur sibuk semasa waktu puncak (*peak hours*), tutup suis ini untuk menyekat pesanan luar sementara waktu.

---

## 05. Sistem Paparan Dapur (KDS) & Notifikasi

- **Pautan Dapur:** `https://warungjnj.online/kitchen`
- **Kebenaran Audio:** Tekan skrin KDS sekali pada waktu pagi semasa mula membuka pelayar untuk mengaktifkan kebenaran amaran bunyi loceng (Audio Beep Alert) setiap kali pesanan baharu masuk.
- **Status Tiket Dapur:**
  - **Menunggu (Pending / Kuning):** Pesanan baharu masuk. Tekan *"Mula Masak"*.
  - **Sedang Masak (Cooking / Biru):** Makanan sedang dimasak bersama pemasa (*timer*).
  - **Sedia Dihidang (Ready / Hijau):** Makanan siap untuk dihantar ke meja pelanggan.
  - **Selesai (Served / Kelabu):** Tiket dialihkan ke arkib.

---

## 06. Pengurusan Meja & Kod QR Meja

1. Buka menu **Meja (/tables)**.
2. Klik mana-mana meja (A1, A2, A3, A4) dan tekan **"Cetak Kod QR Meja"**.
3. Tampal pelekat kod QR di atas meja makan.
4. **Pengalaman Pelanggan:**
   - Pelanggan imbas kod QR guna telefon untuk melihat menu dan memesan makanan terus.
   - Butang **"🛎️ Panggil Pelayan"** di telefon pelanggan akan membunyikan loceng amaran di kaunter juruwang beserta nombor meja.

---

## 07. Pengurusan Menu, Harga & Stok Inventori

1. Buka menu **Menu (/menu)** dan tekan butang **"+ Tambah Menu"**.
2. Masukkan Nama, Kategori, Harga Jualan (RM), dan Gambar Hidangan.
3. Tetapkan bilangan stok fizikal dan had amaran stok rendah (*Low Stock Threshold*).
4. Suis **In Stock / Out of Stock** membolehkan Admin mematikan item yang kehabisan bahan serta-merta tanpa memadam menu.

---

## 08. Pesanan Penghantaran & Portal Rider

- **Formula Jarak GPS Cawangan Penampang:**
  - Kadar: RM 1.00 bagi setiap 1 KM jarak.
  - Caj minimum: RM 2.00 (bagi jarak 0 – 2.0 KM).
  - Had radius maksimum: 15.0 KM dari koordinat warung.
  - Pesanan minimum: RM 15.00.
- **Portal Rider (`/rider`):** Rider melihat senarai pesanan, alamat pelanggan, pautan navigasi peta GPS, dan mengambil gambar bukti serahan (*Proof of Delivery / POD*) semasa makanan diserahkan.

---

## 09. Dashboard Analitik & Prestasi Jualan

- Pantau jumlah jualan harian secara masa nyata (*Realtime*).
- Perbandingan peratusan prestasi jualan semalam vs hari ini.
- Senarai 5 menu paling laris (*Top Selling Items*) untuk perancangan stok bahan mentah.

---

## 10. Jejak Audit & Kawalan Pengubahsuaian

Semua pengubahsuaian berisiko dirakam tanpa padam di **Log Audit (`/settings/audit-log`)**:
- Pengeditan jumlah pesanan (rekod nilai lama vs baharu & sebab).
- Pemadaman perbelanjaan laci tunai.
- Pembukaan semula kaunter tunai (*Reopen register*).

---

## 11. Tetapan Pencetak Resit Terma

1. Buka menu **Tetapan (/settings)**.
2. Pilih saiz kertas pencetak: **58mm** (Bluetooth mudah alih) atau **80mm** (POS standard).
3. Tekan **"Cetak Resit Ujian (Test Print)"** untuk mengesahkan sambungan.

---

## 12. Soalan Lazim & Tindakan Kecemasan (FAQ)

- **Jika internet terputus semasa berniaga?**
  Sistem dilengkapi *localStorage fallback*. Buka dan tutup kaunter tetap boleh beroperasi tanpa tersekat. Data akan diselaraskan ke awan Supabase sebaik sahaja internet pulih.
- **Dapur tidak berbunyi?**
  Sentuh skrin dapur sekali pada waktu pagi untuk memberi kebenaran audio pelayar (*browser autoplay permission*).
- **Duit laci tidak seimbang?**
  Semak perbelanjaan laci di Pengurusan Tunai. Pastikan semua pembelian tunai kecil (ais/sayur/gas) telah direkodkan.
