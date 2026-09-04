export function renderErrorPage(_error?: unknown): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Warung J&J</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #1c1917; color: #f5f5f4; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.5rem; margin: 0 0 0.5rem; font-weight: 700; color: #ea580c; }
      p { color: #a8a29e; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.6rem 1.2rem; border-radius: 9999px; font: inherit; font-weight: 600; cursor: pointer; text-decoration: none; border: none; }
      .primary { background: #ea580c; color: #fff; }
      .secondary { background: #292524; color: #d6d3d1; border: 1px solid #44403c; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Warung J&J</h1>
      <p>Something went wrong loading this page. Please try refreshing.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Refresh Page</button>
        <a class="secondary" href="/">Go to Homepage</a>
      </div>
    </div>
  </body>
</html>`;
}
