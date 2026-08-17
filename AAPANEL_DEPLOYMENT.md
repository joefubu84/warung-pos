# 🚀 aaPanel Container (CT 101) Deployment Guide — Warung J&J POS & Delivery

This guide provides step-by-step instructions to deploy the **Warung J&J POS & Online Delivery Application** on your **aaPanel Container (CT 101)** running Nginx, PHP 8.4, and MariaDB.

---

## 🟢 Server Specifications
- **Host / Container:** aaPanel CT 101
- **Local LAN IP:** `192.168.0.183`
- **Tailscale / VPN IP:** `100.76.188.54`
- **aaPanel Panel URL:** `https://192.168.0.183:13957/0c8c9e79`
- **Services:** Nginx Web Server, MariaDB 3306, Node.js (PM2)

---

## 📦 Step 1: Build Production Assets Locally
On your development machine, run the production build command:

```bash
npm run build
```

This generates the `.output` directory containing:
- Static Frontend Assets: `.output/public`
- Node.js SSR Server: `.output/server/index.mjs`

---

## 🌐 Step 2: Set Up Website in aaPanel

1. Log into **aaPanel**: `https://192.168.0.183:13957/0c8c9e79`
2. Go to **Website** → **Add Site**.
3. Set **Domain Name**: `warungjnj.com` (or your LAN IP `192.168.0.183` / `pos.local`).
4. Set **Root Directory**: `/www/wwwroot/warungjnj.com`
5. Select **FTP** / **Database** as needed (or default).
6. Click **Submit**.

---

## 🚀 Step 3: Deploy Project Files

### Option A: Upload Pre-built Files via aaPanel File Manager
1. In aaPanel, open **Files** → Navigate to `/www/wwwroot/warungjnj.com`.
2. Zip your local project directory (excluding `node_modules`).
3. Upload the `.zip` file and extract it inside `/www/wwwroot/warungjnj.com`.

### Option B: Clone via Git in aaPanel Terminal
Open aaPanel **Terminal** or SSH into CT 101 (`192.168.0.183`) and run:

```bash
cd /www/wwwroot/warungjnj.com
git clone <your-repo-url> .
npm install
npm run build
```

---

## ⚡ Step 4: Run Node.js Application with aaPanel PM2 / Node Project Manager

1. Open aaPanel → **App Store** → Install **Node.js version manager** (or PM2 Manager).
2. Go to **Website** → **Node project** → **Add Node project**.
3. Configure the fields:
   - **Project directory:** `/www/wwwroot/warungjnj.com`
   - **Project name:** `warung-pos`
   - **Run option:** `node .output/server/index.mjs` (or `npm run preview` / `npm run dev`)
   - **Port:** `3000` (or `8080`)
   - **User:** `www`
4. Click **Submit** to start the service.

---

## ⚙️ Step 5: Nginx Configuration for aaPanel

In aaPanel → **Website** → Click **Conf** (Config) for `warungjnj.com` → Paste the following Nginx configuration block inside your server block:

```nginx
server {
    listen 80;
    server_name 192.168.0.183 100.76.188.54 warungjnj.com;

    root /www/wwwroot/warungjnj.com/.output/public;
    index index.html index.htm;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
    gzip_min_length 1000;

    # Static Assets Caching
    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # SPA Route Fallback & Reverse Proxy
    location / {
        try_files $uri $uri/ @node_proxy;
    }

    # Node.js SSR / API Reverse Proxy
    location @node_proxy {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";
}
```

---

## 🔒 Step 6: Supabase & Environment Variables Setup

Ensure your environment variables in `.env` (or `.env.production`) inside `/www/wwwroot/warungjnj.com` match your production Supabase project:

```env
VITE_SUPABASE_URL=https://your-supabase-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

---

## ✅ Step 7: Verify Server Health

- Access via Local LAN: `http://192.168.0.183`
- Access via Tailscale VPN: `http://100.76.188.54`
- Access aaPanel Dashboard: `https://192.168.0.183:13957/0c8c9e79`
