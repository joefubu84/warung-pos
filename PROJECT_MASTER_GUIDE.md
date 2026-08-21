# 🍜 Warung J&J POS & Delivery — Master Architecture & Deployment Guide
> **Dokumentasi Lengkap Sistem Pengurusan Restoran & POS Multi-Store**  
> *Versi: 1.0.0 | Terakhir Dikemaskini: 20 Ogos 2026*

---

## 📌 1. Ringkasan Projek (Project Overview)

**Warung J&J POS** adalah aplikasi sistem tempat jualan (Point of Sale) moden dan sistem pesanan atas talian untuk restoran tempatan, dibina menggunakan seni bina web pantas dengan Server-Side Rendering (SSR) di Edge.

* 🌐 **Domain Rasmi:** [https://warungjnj.online](https://warungjnj.online)
* ⚡ **Cloudflare Worker URL:** [https://warung-pos.josephsudarso05.workers.dev](https://warung-pos.josephsudarso05.workers.dev)
* 🐙 **GitHub Repository:** [https://github.com/joefubu84/warung-pos](https://github.com/joefubu84/warung-pos) (Branch: `main`)
* 📍 **Lokasi Warung:** Warung J&J, Jalan Penampang, 89500 Penampang, Sabah, Malaysia (`5.918° N, 116.082° E`)
* 📞 **Hubungi:** `017-222 1784`

---

## 🏬 2. Maklumat Cawangan & Multi-Store (Tenant Configuration)

### 🏪 Cawangan Utama (Store A — Warung J&J Penampang)
* **Store ID:** `1094d737-8104-4a55-b678-0fe9097beba0`
* **Lokasi GPS:** Penampang, Sabah (`5.918, 116.082`)
* **Kadar Penghantaran:** RM 1.00 / km (Caj minimum: RM 2.00, Radius maksimum: 15.0 km, Pesanan Min: RM 15.00)
* **Admin Staff Email:** `teststaffa@test.com` (`0f81ea5a-e622-4343-a188-62f90dc1ef14`)
* **Akaun Bank:** Alliance Bank (`101960010088888` / `J&J CAFE & CATERING`)

### 🏪 Cawangan Tambahan (Store B — Expansion Branch)
* **Store ID:** `fcf17ed0-711a-45b7-a8b1-d7a00479f590`
* **Staff User ID:** `c9e59f5a-6ef1-41a3-96f5-55dc1c11f6e1` (`Staff B`)
* **Pemisahan Data (Data Isolation):** Dikuatkuasakan 100% menggunakan PostgreSQL Row Level Security (RLS) dan fungsi `get_auth_store_id()`.

---

## 🛠️ 3. Tech Stack & Seni Bina (Architecture)

| Komponen | Teknologi | Keterangan |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19 + TypeScript | Antaramuka pantas, responsif & reaktif |
| **Routing & SSR** | TanStack Start + TanStack Router | Full-stack routing & server-side rendering |
| **Styling** | Tailwind CSS + Lucide Icons | Reka bentuk gelap moden (Apple/Minimalist Dark) |
| **Server Engine** | Nitro 3 (Preset: `cloudflare-module`) | Output single bundle untuk Cloudflare Worker V8 isolate |
| **Database & Auth** | Supabase (PostgreSQL + Auth) | Storan data awan masa nyata (Real-time DB) |
| **Pembayaran** | ToyyibPay Gateway | FPX & DuitNow QR (Ringgit Malaysia) |
| **Notifikasi** | WhatsApp Gateway / OTP | Penghantaran resit & pengesahan pelanggan |

---

## ☁️ 4. Maklumat Pelayan & Infrastruktur (Deployment)

### A. Cloudflare Edge (Produksi Utama)
* **Penyedia Domain:** Hostinger (Tamat: 2027-08-19)
* **Cloudflare Nameservers:**
  * `maria.ns.cloudflare.com`
  * `miles.ns.cloudflare.com`
* **Worker Project Name:** `warung-pos`
* **Custom Domain Mapping:** `warungjnj.online` & `www.warungjnj.online`
* **Build Command:** `npm run build`
* **Deploy Output:** `.output/server/index.mjs` & `.output/public`

### B. aaPanel Local VM (VirtualBox Server)
* **Nama VM:** `aaPanel-Debian` (Network: Bridged Adapter)
* **IP Tempatan (LAN):** `192.168.0.175`
* **URL aaPanel:** `https://192.168.0.175:28319/5d47c177`
* **aaPanel Username:** `3pmvo2yk`
* **aaPanel Password:** `janda10`
* **Direktori Projek VM:** `/www/wwwroot/warung-pos`
* **Pengurusan Proses:** PM2 (`pm2 start "bun run dev" --name "warung-pos"`)
* **Port Aktif:** `5173` (Vite Web App) & `3000`

---

## 🗄️ 5. Skrip SQL Pangkalan Data (Supabase Migration)

Skrip SQL lengkap untuk keselamatan dan fungsi pesanan di **Supabase SQL Editor**:

```sql
-- 1. Table Columns Safety
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS latitude numeric DEFAULT 5.918;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS longitude numeric DEFAULT 116.082;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS delivery_rate numeric DEFAULT 1.00;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS fulfillment_type text DEFAULT 'takeaway';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- 2. Store Resolver Helper
CREATE OR REPLACE FUNCTION public.get_auth_store_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;

  BEGIN
    SELECT store_id INTO v_store_id FROM public.profiles WHERE id = auth.uid();
    IF v_store_id IS NOT NULL THEN RETURN v_store_id; END IF;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    SELECT store_id INTO v_store_id FROM public.users WHERE id = auth.uid();
    IF v_store_id IS NOT NULL THEN RETURN v_store_id; END IF;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN NULL;
END;
$$;

-- 3. Hardened place_order RPC with Haversine Distance
CREATE OR REPLACE FUNCTION public.place_order(
  p_order jsonb,
  p_items jsonb,
  p_payments jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_order_id uuid;
  v_item record;
  v_real_price numeric;
  v_qty int;
  v_food_subtotal numeric := 0;
  v_delivery_fee numeric := 0;
  v_total_amount numeric := 0;
  v_order_type_text text;
  v_order_type_enum order_type;
  v_fulfillment_type fulfillment_type_enum;
  v_table_id uuid := NULL;
  v_created_order jsonb;
  v_payment_method payment_method_enum := 'qr'::payment_method_enum;
  
  v_store_lat numeric;
  v_store_lng numeric;
  v_rate numeric;
  v_cust_lat numeric;
  v_cust_lng numeric;
  v_dist_km numeric;
  v_min_order numeric := 15.00;
BEGIN
  IF (p_order->>'store_id') IS NOT NULL AND (p_order->>'store_id') != '' THEN
    v_store_id := (p_order->>'store_id')::uuid;
  ELSIF auth.uid() IS NOT NULL THEN
    v_store_id := get_auth_store_id();
  ELSE
    RAISE EXCEPTION 'store_id is required for placing orders.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = v_store_id AND is_active = true) THEN
    RAISE EXCEPTION 'Invalid or inactive store.';
  END IF;

  v_order_type_text := COALESCE(p_order->>'type', 'takeaway');
  BEGIN
    v_order_type_enum := v_order_type_text::order_type;
  EXCEPTION WHEN OTHERS THEN
    v_order_type_enum := 'takeaway'::order_type;
  END;

  IF (p_order->>'table_id') IS NOT NULL AND (p_order->>'table_id') != '' THEN
    v_table_id := (p_order->>'table_id')::uuid;
  END IF;

  v_fulfillment_type := CASE WHEN v_order_type_text = 'dine_in' THEN 'dine_in'::fulfillment_type_enum ELSE 'takeaway'::fulfillment_type_enum END;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item.';
  END IF;

  INSERT INTO public.orders (
    store_id, table_id, type, status, payment_status, total_amount,
    customer_name, customer_phone, delivery_address, notes, payment_reference
  ) VALUES (
    v_store_id, v_table_id, v_order_type_enum, 'pending', 'unpaid', 0,
    p_order->>'customer_name', p_order->>'customer_phone',
    p_order->>'delivery_address', p_order->>'notes', p_order->>'payment_reference'
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT price INTO v_real_price
    FROM public.menu_items
    WHERE id = (v_item.value->>'menu_item_id')::uuid AND store_id = v_store_id;

    IF v_real_price IS NULL THEN
      RAISE EXCEPTION 'Menu item % does not exist for this store.', (v_item.value->>'menu_item_id');
    END IF;

    v_qty := GREATEST(COALESCE((v_item.value->>'quantity')::int, 1), 1);
    v_food_subtotal := v_food_subtotal + (v_real_price * v_qty);

    INSERT INTO public.order_items (
      order_id, menu_item_id, quantity, price_at_order, notes, fulfillment_type
    ) VALUES (
      v_order_id, (v_item.value->>'menu_item_id')::uuid, v_qty, v_real_price, v_item.value->>'notes', v_fulfillment_type
    );
  END LOOP;

  IF v_order_type_text = 'delivery' THEN
    IF v_food_subtotal < v_min_order THEN
      RAISE EXCEPTION 'Minimum delivery order is RM%.', to_char(v_min_order, 'FM999990.00');
    END IF;

    SELECT latitude, longitude, COALESCE(delivery_rate, 1.00)
    INTO v_store_lat, v_store_lng, v_rate
    FROM public.stores WHERE id = v_store_id;

    v_cust_lat := (p_order->>'customer_lat')::numeric;
    v_cust_lng := (p_order->>'customer_lng')::numeric;

    IF v_cust_lat IS NOT NULL AND v_cust_lng IS NOT NULL AND v_store_lat IS NOT NULL AND v_store_lng IS NOT NULL THEN
      v_dist_km := 6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_store_lat)) * cos(radians(v_cust_lat)) *
          cos(radians(v_cust_lng) - radians(v_store_lng)) +
          sin(radians(v_store_lat)) * sin(radians(v_cust_lat))
        ))
      );

      IF v_dist_km > 15.0 THEN
        RAISE EXCEPTION 'Delivery address is outside our 15km radius (% km).', ROUND(v_dist_km, 1);
      END IF;

      v_delivery_fee := GREATEST(ROUND(v_dist_km * v_rate, 2), 2.00);
    ELSE
      v_delivery_fee := 2.00;
    END IF;
  END IF;

  v_total_amount := v_food_subtotal + v_delivery_fee;

  UPDATE public.orders
  SET total_amount = v_total_amount,
      delivery_fee = v_delivery_fee
  WHERE id = v_order_id;

  SELECT to_jsonb(o.*) INTO v_created_order
  FROM public.orders o WHERE o.id = v_order_id;

  RETURN v_created_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_store_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, jsonb, jsonb) TO anon, authenticated, service_role;
```

---

## 💳 6. ToyyibPay FPX Gateway Settings

* **Return URL:** `https://warungjnj.online/delivery`
* **Callback URL (Webhook):** `https://warungjnj.online/api/payment/callback`
* **Admin Settings URL:** `https://warungjnj.online/settings`

---

## 🚀 7. Panduan Pembangunan & Perintah CLI (Workflow)

### Pembangunan Tempatan:
```bash
cd C:\Users\joefubu05\.gemini\antigravity\scratch\warung-pos
npm install
npm run dev
# Buka pelayar: http://localhost:5173
```

### Membina & Deploy ke GitHub / Cloudflare:
```bash
git add .
git commit -m "feat: kemaskini menu dan tetapan baru"
git push origin main
```

### Mengemaskini Pelayan aaPanel VM:
```bash
cd /www/wwwroot/warung-pos
git pull origin main
pm2 restart warung-pos
```

---

## 🔧 8. Nota Teknikal & Penyelesaian Ralat (Fixes)

1. **Nitro Single-Chunk Bundle (`createCsrfMiddleware is not a function`):**
   * Di dalam `vite.config.ts`, Nitro menggunakan `inlineDynamicImports: true` untuk mengelak isu circular imports pada fail server.
2. **Definisi `__dirname` di Cloudflare Worker:**
   * Ditambah konfigurasi `replace: { __dirname: '""', __filename: '""' }` dalam Nitro dan `define` dalam Vite.
3. **SSR Safety untuk `localStorage`:**
   * Di dalam `src/lib/addons-config.ts` dan `src/lib/auth-state.ts`, semua operasi storan pelayar dilindungi dengan `typeof localStorage !== 'undefined'`.

---

## 📁 9. Lokasi Fail Perbualan & Log AI
* **Folder Fail Projek:** `C:\Users\joefubu05\.gemini\antigravity\scratch\warung-pos\`
* **Folder Data Perbualan AI:** `C:\Users\joefubu05\.gemini\antigravity\brain\6c435371-87b9-430e-9d27-5a3586d22ce5\`
* **Fail Log Transkrip Perbualan:** `C:\Users\joefubu05\.gemini\antigravity\brain\6c435371-87b9-430e-9d27-5a3586d22ce5\.system_generated\logs\transcript.jsonl`

---
*Disediakan khas untuk Warung J&J.*
