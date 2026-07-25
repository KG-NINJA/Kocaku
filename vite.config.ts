import { defineConfig } from "vite";

// Relative asset URLs work both at the repository Pages URL and at a custom domain.
export default defineConfig({
  base: "./",
  build: {
    sourcemap: false
  }
});
