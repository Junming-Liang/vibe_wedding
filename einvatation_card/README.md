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
| `src/App.css` | 移动端优先的样式 |
| `index.html` | 入口 HTML，含 viewport / 主题色 |
| `vite.config.ts` | Vite 与开发服务器配置 |

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
```