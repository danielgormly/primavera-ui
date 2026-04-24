import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        otp: resolve(__dirname, "src/otp/index.ts"),
        dnd: resolve(__dirname, "src/dnd/index.ts"),
        cal: resolve(__dirname, "src/cal/index.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: ["@flatten-js/interval-tree"],
    },
  },
});
