import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import type { AuthState } from "../lib/auth-state";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  const errorMessage = error?.message || String(error || "");
  const isChunkLoadError =
    errorMessage.includes("dynamically imported module") ||
    errorMessage.includes("error loading dynamically imported module") ||
    errorMessage.includes("Importing a module script failed") ||
    errorMessage.includes("Loading chunk");

  useEffect(() => {
    if (isChunkLoadError) {
      const key = "warung_chunk_reload_ts";
      const last = sessionStorage.getItem(key);
      const now = Date.now();
      if (!last || now - parseInt(last, 10) > 12000) {
        sessionStorage.setItem(key, String(now));
        window.location.reload();
      }
    }
  }, [isChunkLoadError]);

  if (isChunkLoadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4 text-slate-800">
        <div className="max-w-md w-full text-center p-8 bg-white border border-slate-200 rounded-3xl shadow-2xl">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-5" />
          <h1 className="text-xl font-black text-emerald-400 tracking-tight">
            Memuat Semula Versi Terkini...
          </h1>
          <p className="mt-3 text-sm text-slate-400 leading-relaxed">
            Sistem Warung J&J telah menerima kemaskini baharu. Halaman sedang disegarkan secara automatik untuk memuat turun kod terkini.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => {
                sessionStorage.clear();
                window.location.reload();
              }}
              className="w-full inline-flex items-center justify-center rounded-xl bg-emerald-500 hover:bg-emerald-400 py-3 text-sm font-bold text-slate-950 transition-colors shadow-lg shadow-emerald-950/40 cursor-pointer"
            >
              Segarkan Sekarang (Refresh)
            </button>
            <a
              href="/counter"
              className="w-full inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-800/60 hover:bg-slate-800 py-2.5 text-xs font-semibold text-slate-300 transition-colors"
            >
              Buka Counter POS
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <pre className="mt-2 text-xs text-red-500 text-left bg-black p-4 rounded overflow-auto">
          {error?.message || "Unknown error"}
          {"\n"}
          {error?.stack}
        </pre>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  auth: AuthState;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" },
      { name: "theme-color", content: "#ea580c" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Warung J&J" },
      { title: "Warung J&J POS | Enterprise Restaurant Management" },
      { name: "description", content: "Professional multi-store POS ecosystem for modern Malaysian hospitality. Scale your culinary empire with zero-trust data isolation." },
      { name: "author", content: "Warung J&J" },
      { property: "og:title", content: "Warung J&J POS | Enterprise Restaurant Management" },
      { property: "og:description", content: "Professional multi-store POS ecosystem for modern Malaysian hospitality." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@WarungJnJ" },
    ],
    links: [
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600;700&family=Comfortaa:wght@400;600;700&family=Nunito:wght@600;700;800;900&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "manifest", href: "/manifest.json" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  if (typeof window !== 'undefined' && window.location) {
                    var h = window.location.hostname;
                    if (h.indexOf('lovable.app') !== -1 || h.indexOf('lovableproject.com') !== -1 || h.indexOf('lovable.dev') !== -1) {
                      window.location.replace('https://warungjnj.online' + window.location.pathname + window.location.search + window.location.hash);
                    }
                  }
                } catch (e) {}

                // Auto-recover seamlessly from stale dynamic import chunks / new deployments
                function recoverOutdatedChunks(reason) {
                  try {
                    var key = 'warung_chunk_reload_ts';
                    var last = sessionStorage.getItem(key);
                    var now = Date.now();
                    // Debounce reload: at most once per 12 seconds
                    if (!last || now - parseInt(last, 10) > 12000) {
                      sessionStorage.setItem(key, String(now));
                      console.warn('Warung POS: Chunk load error (' + reason + '). Reloading page to fetch latest version...');
                      window.location.reload();
                    }
                  } catch (err) {
                    window.location.reload();
                  }
                }

                // 1. Vite's built-in preload error event (dispatched when dynamic chunk fails to load)
                window.addEventListener('vite:preloadError', function(event) {
                  if (event && event.preventDefault) {
                    event.preventDefault();
                  }
                  recoverOutdatedChunks('vite:preloadError');
                });

                // 2. Unhandled promise rejections (Failed to fetch dynamically imported module)
                window.addEventListener('unhandledrejection', function(event) {
                  var reason = (event && event.reason) ? (event.reason.message || String(event.reason)) : '';
                  if (
                    reason.indexOf('dynamically imported module') !== -1 ||
                    reason.indexOf('error loading dynamically imported module') !== -1 ||
                    reason.indexOf('Importing a module script failed') !== -1 ||
                    reason.indexOf('Loading chunk') !== -1
                  ) {
                    if (event && event.preventDefault) {
                      event.preventDefault();
                    }
                    recoverOutdatedChunks(reason);
                  }
                });

                // 3. Global window error events
                window.addEventListener('error', function(event) {
                  var message = (event && event.message) ? String(event.message) : '';
                  if (
                    message.indexOf('dynamically imported module') !== -1 ||
                    message.indexOf('error loading dynamically imported module') !== -1 ||
                    message.indexOf('Importing a module script failed') !== -1 ||
                    message.indexOf('Loading chunk') !== -1
                  ) {
                    recoverOutdatedChunks(message);
                  }
                });
              })();
            `,
          }}
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              a[href*="lovable.dev"],
              a[href*="lovable.app"],
              [id*="lovable-badge"],
              [id*="lovable_badge"],
              [id*="lovable"],
              [class*="lovable-badge"],
              [class*="lovable_badge"],
              [data-lovable-badge],
              [aria-label*="Lovable" i],
              [title*="Lovable" i],
              div:has(> a[href*="lovable.dev"]),
              div:has(> a[href*="lovable.app"]),
              div:has(> [id*="lovable-badge"]),
              div:has(> [class*="lovable-badge"]) {
                display: none !important;
                opacity: 0 !important;
                visibility: hidden !important;
                pointer-events: none !important;
                position: absolute !important;
                top: -9999px !important;
                left: -9999px !important;
                width: 0 !important;
                height: 0 !important;
                max-width: 0 !important;
                max-height: 0 !important;
                overflow: hidden !important;
                z-index: -9999 !important;
              }
            `,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

import { NavigationHeader } from "../components/NavigationHeader";
import { useLocation } from "@tanstack/react-router";

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const location = useLocation();
  
  // Enforce production custom domain (warungjnj.online) and register Service Worker
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host.includes('lovable.app') || host.includes('lovableproject.com')) {
        try {
          if (window.self === window.top) {
            window.location.replace(`https://warungjnj.online${window.location.pathname}${window.location.search}${window.location.hash}`);
          }
        } catch {}
      }

      // Register PWA Service Worker with immediate update check and no HTTP cache on sw script
      if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
        navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((reg) => {
          reg.update().catch(() => {});

          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                }
              });
            }
          });
        }).catch(() => {});

        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!refreshing) {
            refreshing = true;
            window.location.reload();
          }
        });
      }
    }
  }, []);

  // Hide the POS admin header on customer and rider portal pages
  const isCustomerFacing = 
    location.pathname === '/' || 
    location.pathname === '/delivery' || 
    location.pathname.startsWith('/t/') ||
    location.pathname.startsWith('/rider');

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        {!isCustomerFacing && <NavigationHeader />}
        <main className="flex-1 flex flex-col">
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
        </main>
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}
