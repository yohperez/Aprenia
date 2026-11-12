import { writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import { defineConfig, type Plugin } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

function serviceWorker(): Plugin {
  return {
    name: "yara-service-worker",
    apply: "build",
    writeBundle(options, bundle) {
      const files = Object.keys(bundle).map((name) => `/${name}`);
      const version = files.join("|").length.toString(36) + Date.now().toString(36);
      const template = readFileSync(resolve(root, "src/sw.js"), "utf8");
      const output = template
        .replace("__VERSION__", version)
        .replace("__PRECACHE__", JSON.stringify(["/", "/manifest.webmanifest", "/brand/icon-192.png", "/brand/logo.webp", "/brand/butterfly.webp", ...files]));
      writeFileSync(resolve(options.dir ?? "dist", "sw.js"), output);
    },
  };
}

const apiTarget = process.env.YARA_API_PROXY ?? "http://localhost:8000";

export default defineConfig({
  plugins: [preact(), serviceWorker()],
  server: { proxy: { "/v1": apiTarget, "/health": apiTarget } },
  preview: { proxy: { "/v1": apiTarget, "/health": apiTarget } },
  build: { target: "es2019", cssCodeSplit: false, modulePreload: { polyfill: false } },
});
