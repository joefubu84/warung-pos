// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: {
    rollupConfig: {
      output: {
        inlineDynamicImports: true,
      },
    },
    replace: {
      __dirname: '""',
      __filename: '""',
    },
  },
  vite: {
    define: {
      __dirname: '""',
      __filename: '""',
    },
    plugins: [
      {
        name: 'remove-csp-middleware',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            res.removeHeader('Content-Security-Policy');
            res.removeHeader('Content-Security-Policy-Report-Only');
            next();
          });
        }
      }
    ],
    server: {
      headers: {
        'Content-Security-Policy': '',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  },
});
