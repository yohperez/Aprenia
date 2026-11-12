import { writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import preact from "@preact/preset-vite";
import { defineConfig, type Plugin } from "vite";

function serviceWorker(): Plugin {
  return {
    name: "yara-service-worker",
    apply: "build",
    writeBundle(options, bundle) {
      const files = Object.keys(bundle).map((name) => `/${name}`);
      const version = files.join("|").length.toString(36) + Date.now().toString(36);
      const template = readFileSync(resolve(__dirname, "src/sw.js"), "utf8");
      const output = template
        .replace("__VERSION__", version)
        .replace("__PRECACHE__", JSON.stringify(["/", "/manifest.webmanifest", "/icon.svg", ...files]));
      writeFileSync(resolve(options.dir ?? "dist", "sw.js"), output);
    },
  };
}

export default defineConfig({
  plugins: [preact(), serviceWorker()],
  build: { target: "es2019", cssCodeSplit: false, modulePreload: { polyfill: false } },
});
