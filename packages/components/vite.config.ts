import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { resolve } from "path";

export default defineConfig({
  root: "dev",
  plugins: [solid()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        otp: resolve(__dirname, "src/otp/index.ts"),
        dnd: resolve(__dirname, "src/dnd/index.ts"),
        "dnd-solid": resolve(__dirname, "src/dnd/solid/index.ts"),
        cal: resolve(__dirname, "src/cal/index.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: ["@flatten-js/interval-tree", "solid-js", "solid-js/web", "solid-js/store"],
    },
  },
});
