import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** 与主站同域时使用子路径，须与 Nginx location 一致；改路径后需重新 npm run build */
const BASE = "/invite-2026/";
const API_PREFIX = `${BASE.replace(/\/$/, "")}/api`;

export default defineConfig({
  base: BASE,
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      /**
       * 仅代理请柬子路径下的 API，避免与生产环境「根路径 /api」方案混淆；
       * 与 WordPress 同域部署时也不要在 Nginx 里占用 /api，以免与插件或其它应用冲突。
       */
      [API_PREFIX]: {
        target: "http://127.0.0.1:3840",
        changeOrigin: true,
        rewrite: (path) => path.replace(API_PREFIX, "/api"),
      },
    },
  },
});
