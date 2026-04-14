import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** 与主站同域时使用子路径，须与 Nginx location 一致；改路径后需重新 npm run build */
const BASE = "/wedding-invite/";

export default defineConfig({
  base: BASE,
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
});
