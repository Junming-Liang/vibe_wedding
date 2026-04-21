# 婚礼电子请柬（React + Vite）

面向手机访问的单页请柬骨架：窄屏排版、安全区、触控友好的按钮尺寸。文案集中在 `src/App.tsx` 的 `INVITE` 对象里修改即可。

## 环境要求

在运行本项目前，需要本机已安装 **Node.js** 与 **npm**。

- **最低**：Node **12.20+**（与当前锁定的 Vite 2 工具链一致，便于在老环境上跑通）。  
- **强烈建议**：尽快升级到 **Node 20 LTS** 或 **22 LTS**，以便日后使用新版 Vite / React 与安全更新。

若执行 `npm run dev` 时出现 **`SyntaxError: Unexpected reserved word`**，且 `node -v` 显示 **v12 以下**，说明 Node 过旧，无法运行新版 Vite；请升级 Node，或使用本仓库已降级的依赖后重新执行 `npm install`。

### 如何安装 Node.js（任选其一）

1. **官网安装包**  
   打开 [https://nodejs.org/](https://nodejs.org/)，下载 LTS 版本，按向导安装。安装完成后在终端执行：
   ```bash
   node -v
   npm -v
   ```
   能输出版本号即表示成功。

2. **nvm（适合需要多版本 Node 的开发者）**  
   参考 [https://github.com/nvm-sh/nvm](https://github.com/nvm-sh/nvm) 安装 nvm 后：
   ```bash
   nvm install --lts
   nvm use --lts
   ```

3. **Ubuntu / Debian（apt，版本可能偏旧，建议仍优先用官网或 nvm）**  
   ```bash
   sudo apt update
   sudo apt install -y nodejs npm
   ```

若 `node -v` 提示命令不存在，说明尚未安装成功，需先完成上述步骤之一。

## 安装依赖

在项目根目录（本目录）执行：

```bash
cd ~/program/vibe_wedding/einvatation_card
npm install
```

## 本地开发（电脑浏览器）

```bash
npm run dev
```

终端会打印本地地址（一般为 `http://localhost:5173`）。Vite 已配置 `server.host: true`，便于局域网内用手机访问。

## 用手机访问（与电脑同一 Wi‑Fi）

1. 电脑运行 `npm run dev`。  
2. 查看终端里的 **Network** 地址（形如 `http://192.168.x.x:5173`）。  
3. 在手机浏览器输入该地址。  
若无法打开，请检查防火墙是否放行 **5173** 端口。

## 生产构建与预览

```bash
npm run build
npm run preview
```

`build` 产物在 `dist/`，可部署到任意静态托管（如 Nginx、OSS、Vercel 等）。

## 目录说明

| 路径 | 说明 |
|------|------|
| `src/App.tsx` | 请柬结构与文案常量 `INVITE` |
| `src/MessageWall.tsx` | 祝福留言表单 + 审核通过后滚动展示的留言墙 |
| `src/App.css` | 移动端优先的样式 |
| `index.html` | 入口 HTML，含 viewport / 主题色 |
| `vite.config.ts` | Vite 与开发服务器配置（仅将 `/invite-2026/api` 代理到本机留言服务） |
| `deploy/nginx-invite-api.snippet.conf` | 将 **`/invite-2026/api/`** 反代到留言服务（不占根 `/api`，便于与 WordPress 并存） |
| `deploy/invite-2026-messages-bridge.php` | **站点根 PHP 桥**（拷到与 `wp-config.php` 同级），在无法为 `/invite-2026/api/` 单独反代时由 PHP curl 转发到本机 Node |

## 祝福留言墙（需后端）

依赖 **`invite_messages_api`**。提交后为 **待审核**；仅 **已通过** 出现在滚动墙。

### 本地联调

1. 另开终端（**Node ≥ 18** 推荐）：

   ```bash
   cd ~/program/vibe_wedding/invite_messages_api
   cp .env.example .env   # CORS_ORIGINS 等；默认监听 127.0.0.1
   npm install && npm run dev
   ```

2. 本目录 **`npm run dev`**。Vite 将 **`/invite-2026/api/*`** 转到本机 **`127.0.0.1:3840`** 的 **`/api/*`**（见 `vite.config.ts`），一般无需 **`VITE_MESSAGES_API`**。

3. **本机**审核：在跑留言服务的机器上 **`curl -sS http://127.0.0.1:3840/api/health`**，用返回的 **`adminUrl`**；或直接打开 **`http://127.0.0.1:<PORT>/admin.html`**（`PORT` 见留言服务 `.env`）。管理仅环回、无密钥；审核页支持 **通过 / 拒绝 / 删除**（删除不可恢复）。

### 生产构建与 API 地址

- **与 WordPress 同域（常见：仅 `try_files` 静态托管 `/invite-2026/`）**：生产构建且未设置 **`VITE_MESSAGES_API`** 时，前端默认走 **站点根 PHP 桥** **`/invite-2026-messages-bridge.php`**（与请柬子目录分离，避免 POST 被 `try_files` 打成 **405**）。部署后须执行一次（路径按你服务器调整）：
  ```bash
  sudo cp deploy/invite-2026-messages-bridge.php /home/wwwroot/wordpress/invite-2026-messages-bridge.php
  sudo chown www:www /home/wwwroot/wordpress/invite-2026-messages-bridge.php
  ```
  并在 **php-fpm** 环境配置 **`INVITE_MSG_UPSTREAM`**（Node 根地址，默认 `http://127.0.0.1:3840`），保证 **`invite_messages_api`** 在本机监听。
- **若已为 Nginx 增加** **`/invite-2026/api/`** 反代到 Node，可不使用 PHP 桥，构建时加上：
  ```bash
  VITE_MESSAGES_USE_PHP_BRIDGE=false npm run build
  ```
- **不要**在整站根路径新增 **`location /api/`** 以免与 WordPress 插件冲突；反代请仅用 **`/invite-2026/api/`**（见 `deploy/nginx-invite-api.snippet.conf`）。
- 若留言服务在 **独立域名**，构建时设置 **`VITE_MESSAGES_API`**（须含 `/api` 段，无末尾斜杠），例如：

  ```bash
  VITE_MESSAGES_API=https://msg.example.com/api npm run build
  ```

### 安全说明（摘要）

限流、体积极限、蜜罐、参数化 SQL 等在 **`invite_messages_api`**；**`HOST` 默认 127.0.0.1**；管理（含删除）仅环回。**`CORS_ORIGINS`** 须为请柬页真实 **`Origin`**（含协议与主机，无路径）。

### 故障：提交失败 405 / 控制台「The string did not match the expected pattern」

- **405**：多为 **`/invite-2026/`** 下 **`try_files`** 把请求交给静态 SPA，**POST 不允许**。处理方式二选一：**(A)** 按 `deploy/nginx-invite-api.snippet.conf` 增加 **`/invite-2026/api/`** 反代到 Node，并 **`VITE_MESSAGES_USE_PHP_BRIDGE=false`** 构建；**(B)** 使用站点根 **`invite-2026-messages-bridge.php`**（见上文「生产构建」），由 PHP 在本机 curl 到 Node。
- **expected pattern**（部分 Safari）：非法 **`fetch` URL** 会触发。请使用合法 **`VITE_MESSAGES_API`**（含 `https://`）；生产默认走站点根 PHP 桥时勿把桥文件放在 **`/invite-2026/`** 内（否则会回落成 HTML）。
- 自检脚本（任意可联网环境）：仓库根执行 **`scripts/verify-invite-messages.sh https://jamilblog.top`**。
- **502 / 留言服务不可达**：桥已通但 **本机 Node 未起** 或 **`INVITE_MSG_UPSTREAM`** 与 Node 不一致。在服务器上 **`curl http://127.0.0.1:3840/api/health`**（含 **`adminUrl`**），详见 **`invite_messages_api/README.md`**。

## 背景音乐

`public/bgm.mp3` 构建后随站点发布。页面使用**隐藏 `<audio>` + 右下角圆形按钮**控制播放；在微信内会走 **`WeixinJSBridge.invoke('getNetworkType', …)`** 再 `play()`，便于系统放行。若仍无声，请检查 iPhone **静音拨杆**，或将 MP3 转为 **44.1kHz 立体声 CBR 128kbps** 再替换。

## 后续可扩展方向（按需自行添加）

- 将「打开地图导航」的 `href` 换成真实高德 / 腾讯 / Google 地图链接。  
- 增加相册轮播、音乐、滚动动效、多语言等。  
- 接入后端表单做 RSVP（需另行部署接口）。

```bash
cd ~/program/vibe_wedding/einvatation_card
npm run build
rsync -av --delete dist/ /home/wwwroot/wordpress/invite-2026/
sudo chown -R www:www /home/wwwroot/wordpress/invite-2026
# 留言墙：首次或更新桥接脚本时执行（与 wp-config 同目录，勿放进 invite-2026）
sudo cp deploy/invite-2026-messages-bridge.php /home/wwwroot/wordpress/invite-2026-messages-bridge.php
sudo chown www:www /home/wwwroot/wordpress/invite-2026-messages-bridge.php
```