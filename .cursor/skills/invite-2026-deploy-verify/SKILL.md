---
name: invite-2026-deploy-verify
description: Builds the wedding invite SPA, rsyncs dist to the WordPress subpath, fixes ownership, and verifies https://jamilblog.top/invite-2026. Use when changing einvatation_card, invite_messages_api deploy docs, or when the user asks to deploy, verify production, or confirm invite-2026 changes are live.
---

# 请柬上线与验证（jamilblog.top /invite-2026）

## 何时使用

- 修改了 `einvatation_card/`（尤其 `src/`、`vite.config.ts`、`public/`）或影响线上展示的配置。
- 用户要求「部署」「上线」「看看线上是否生效」「验证请柬」。

## 标准流程（与 `einvatation_card/README.md` 一致）

在**已安装 Node/npm** 且**具备目标目录写权限**的环境执行（路径以仓库内文档为准；部署机常为 `jamilblog.top` 所在服务器）：

```bash
cd ~/program/vibe_wedding/einvatation_card
npm run build
rsync -av --delete dist/ /home/wwwroot/wordpress/invite-2026/
sudo chown -R www:www /home/wwwroot/wordpress/invite-2026
sudo cp deploy/invite-2026-messages-bridge.php /home/wwwroot/wordpress/invite-2026-messages-bridge.php
sudo chown www:www /home/wwwroot/wordpress/invite-2026-messages-bridge.php
```

- `rsync` 会覆盖 `invite-2026` 下与 `dist/` 对应的静态文件；**不要**把整站 WordPress 根目录当作目标。
- PHP 桥文件必须放在 **WordPress 站点根**（与 `wp-config.php` 同级），**不要**放进 `invite-2026/`，否则仍会 405/HTML。
- `sudo chown` 若在无 sudo 的环境失败，需用户本机处理或改用可写用户。

## 线上验证

1. 用浏览器或 **WebFetch** 打开：`https://jamilblog.top/invite-2026`（注意末尾路径与 `vite.config.ts` 的 `base` 一致）。
2. 确认首屏、倒计时、地图、**祝福留言墙**等与本次改动一致；强刷或禁用缓存后再看一次更稳。
3. 可选：仓库根执行 **`scripts/verify-invite-messages.sh https://jamilblog.top`**，检查 `/invite-2026-messages-bridge.php?action=public` 是否返回 JSON（部署 PHP 桥且 Node 已起时）。

## 留言 API（若相关）

若 Nginx 已配置 **`/invite-2026/api/`** 反代到 Node，可用 **`VITE_MESSAGES_USE_PHP_BRIDGE=false`** 构建并省略站点根 PHP 文件。否则依赖 **`invite-2026-messages-bridge.php`** + 本机 **`invite_messages_api`**（环境变量 **`INVITE_MSG_UPSTREAM`** 指向 Node）。

## 无法在本机 rsync 时

- 仍应执行 `npm run build` 做编译校验。
- 用 WebFetch 检查线上 URL，并告知用户需在部署机执行 rsync/chown，或路径与文档不一致时需自行替换目标目录。
