/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * 留言 API 根路径（不要末尾斜杠），须已包含 `/api` 段。
   * 留空则默认 `{BASE_URL 去掉尾斜杠}/api`（与 `vite.config.ts` 的 `base` 一致，如 `/invite-2026/api`）。
   */
  readonly VITE_MESSAGES_API?: string;
  /**
   * 生产环境是否使用站点根 PHP 桥 `/invite-2026-messages-bridge.php`。
   * 设为 `false` 时强制走 `/invite-2026/api/`（需 Nginx 反代）。未设置时：生产且未配 VITE_MESSAGES_API 则默认走 PHP 桥。
   */
  readonly VITE_MESSAGES_USE_PHP_BRIDGE?: string;
}
