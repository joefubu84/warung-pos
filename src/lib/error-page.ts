export function renderErrorPage(error?: unknown): string {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack}` : String(error || "");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Error</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="font-family: sans-serif; padding: 2rem; background: #111; color: #fff;">
    <h2>Server Error Detail:</h2>
    <pre style="background: #222; padding: 1rem; border-radius: 8px; overflow: auto; color: #f87171;">${message || "No error details available."}</pre>
    <button onclick="location.reload()" style="padding: 0.5rem 1rem; margin-top: 1rem;">Retry</button>
  </body>
</html>`;
}
