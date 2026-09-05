export function renderErrorPage(_error?: unknown): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Warung J&J</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2.5rem 2rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 1.5rem; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
      h1 { font-size: 1.6rem; margin: 0 0 0.5rem; font-weight: 800; color: #ea580c; }
      p { color: #64748b; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.7rem 1.4rem; border-radius: 1rem; font: inherit; font-weight: 700; cursor: pointer; text-decoration: none; border: none; transition: all 0.2s; }
      .primary { background: #ea580c; color: #fff; box-shadow: 0 4px 10px rgba(234, 88, 12, 0.25); }
      .primary:hover { background: #c2410c; }
      .secondary { background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; }
      .secondary:hover { background: #e2e8f0; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Warung J&J</h1>
      <p>Masalah memuatkan halaman. Sila segarkan semula halaman ini.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Segarkan Halaman</button>
        <a class="secondary" href="/">Laman Utama</a>
      </div>
    </div>
  </body>
</html>`;
}
