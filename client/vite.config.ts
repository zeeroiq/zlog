import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  base: "/console/",
  build: {
    emptyOutDir: true,
    outDir: resolve(import.meta.dirname, "../backend/dist/public/console"),
  },
  plugins: [react(), tailwindcss()],
  server: {proxy: {"/api": "http://127.0.0.1:3000"}},
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
})
