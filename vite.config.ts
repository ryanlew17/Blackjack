import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

import { version } from "./package.json";

async function applyScriptHashes(html: string, dev = false): Promise<string> {
  const meta = html.match(
    /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"\s*\/?>/i,
  );
  if (!meta) throw new Error("Missing Content-Security-Policy meta tag");

  const hashes = await Promise.all(
    [
      ...html.matchAll(
        /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script\s*>/gi,
      ),
    ].map(async ([, script]) => {
      // HTML parsing normalizes line endings before CSP checks script text.
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(script.replace(/\r\n?/g, "\n")),
      );
      return `'sha256-${btoa(String.fromCharCode(...new Uint8Array(digest)))}'`;
    }),
  );
  let policy = meta[1].replace(
    "script-src 'self'",
    ["script-src 'self'", ...hashes].join(" "),
  );
  if (dev) {
    policy = policy.replace(
      "connect-src 'none'",
      "connect-src 'self' ws://127.0.0.1:* ws://localhost:*",
    );
  }

  // Vite prepends dev scripts; the policy must precede those as well.
  return html
    .replace(meta[0], "")
    .replace(
      /<head\b[^>]*>/i,
      (head) => `${head}\n${meta[0].replace(meta[1], policy)}`,
    );
}

function contentSecurityPolicy(): Plugin {
  return {
    name: "content-security-policy",
    enforce: "post",
    transformIndexHtml: {
      order: "post",
      handler(html, context) {
        if (context.server) return applyScriptHashes(html, true);
        // The policy is finalized after inlining, so defer singlefile's CSP check.
        return html.replace(
          'http-equiv="Content-Security-Policy"',
          "data-build-csp",
        );
      },
    },
    generateBundle: {
      order: "post",
      async handler(_options, bundle) {
        for (const asset of Object.values(bundle)) {
          if (asset.type === "asset" && asset.fileName.endsWith(".html")) {
            asset.source = await applyScriptHashes(
              String(asset.source).replace(
                "data-build-csp",
                'http-equiv="Content-Security-Policy"',
              ),
            );
          }
        }
      },
    },
  };
}

export default defineConfig({
  // Hash the final script bytes after singlefile has finished inlining them.
  plugins: [react(), viteSingleFile(), contentSecurityPolicy()],
  // @req REQ-2026-007: package.json is the sole version source.
  define: { __APP_VERSION__: JSON.stringify(version) },
  base: "./",
});
