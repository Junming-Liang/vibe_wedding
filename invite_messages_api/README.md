# invite_messages_api（请柬留言）

Node **≥12.20** 可跑（依赖无可选链）；**建议 18+ LTS**。与站点根 **`invite-2026-messages-bridge.php`** 或 Nginx **`/invite-2026/api/`** 反代配合。升级依赖后在 **`invite_messages_api/`** 执行 **`rm -rf node_modules package-lock.json && npm install`**。

## 启动

```bash
cd ~/program/vibe_wedding/invite_messages_api
cp .env.example .env
# PORT、HOST（默认 127.0.0.1）、CORS_ORIGINS（请柬页完整 Origin）
npm install && npm run start
```

默认 **`HOST=127.0.0.1`**、**`PORT=3840`**：不对公网监听；PHP 桥 **`INVITE_MSG_UPSTREAM`** 须指向该根地址（默认 **`http://127.0.0.1:3840`**）。

## 健康检查与审核页

```bash
curl -sS http://127.0.0.1:3840/api/health
```

返回 **`ok`**、**`adminUrl`**（本机审核页 **`http://127.0.0.1:<PORT>/admin.html`**，端口以 `.env` 为准），便于复制/脚本解析；启动日志也会打印审核页 URL。

**管理（仅环回，无 Bearer）**

- **`/api/admin/*`**、**`/admin.html`**：对端须为 **`127.0.0.1` / `::1`**。
- 审核页：**通过 / 拒绝**（待审）+ **删除**（任意状态，**`DELETE /api/admin/messages/:id`**，不可恢复）。
- 远端维护：**`ssh -L 3840:127.0.0.1:3840 user@host`** 后在本机浏览器打开 **`http://127.0.0.1:3840/admin.html`**。

**勿**将 **3840** 对公网放行；**勿**随意 **`HOST=0.0.0.0`**（管理随端口暴露）。

## 提交了留言但后台看不到

1. 筛选 **「待审核」** 或 **「全部」**（新留言默认 `pending`）。  
2. 看 **`[invite_messages_api] SQLite: …`**：相对 **`DATABASE_PATH`** 已相对**包根**解析，避免 cwd 不同导致双库。  
3. **蜜罐**：隐藏框被扩展自动填写会「成功」但未入库；清空后重试。

## 502 / 留言服务不可达

本机 Node 未起、**`PORT` 与 `INVITE_MSG_UPSTREAM` 不一致**、或 PHP 与 Node 不同机未改上游/防火墙。先在跑 Node 的机器上 **`curl …/api/health`**。

## systemd（示例）

```bash
sudo cp deploy/invite-messages-api.service.example /etc/systemd/system/invite-messages-api.service
# 按实际路径编辑 unit 后：
sudo systemctl daemon-reload && sudo systemctl enable --now invite-messages-api
```
