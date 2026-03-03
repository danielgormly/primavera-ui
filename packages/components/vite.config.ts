import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        otp: resolve(__dirname, "src/otp/index.ts"),
      },
      formats: ["es"],
    },
  },
});
