#!/usr/bin/env bash
# 生成并安装 invite-messages-api systemd 单元（开机自启、崩溃重启）。
# 用法（在 invite_messages_api 目录）：
#   sudo ./deploy/install-systemd.sh
# 可选环境变量：
#   NODE_BIN=/usr/bin/node          # 默认先试 /usr/bin/node，否则 PATH 中的 node
#   INVITE_MSG_API_USER=www         # 运行用户；未设置时：路径在 /root/ 下用 root，否则若存在 www 用户则用 www
#   INVITE_MSG_API_GROUP=www        # 运行组；默认取该用户主组（id -gn）

set -euo pipefail

API_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNIT_DST="/etc/systemd/system/invite-messages-api.service"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请使用 root 执行：sudo $0" >&2
  exit 1
fi

if [[ ! -f "$API_ROOT/.env" ]]; then
  echo "缺少 $API_ROOT/.env，请先 cp .env.example .env 并配置。" >&2
  exit 1
fi

NODE_BIN="${NODE_BIN:-}"
if [[ -z "$NODE_BIN" ]]; then
  if [[ -x /usr/bin/node ]]; then
    NODE_BIN=/usr/bin/node
  else
    NODE_BIN="$(command -v node || true)"
  fi
fi
if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  echo "找不到可执行的 node，请设置 NODE_BIN=..." >&2
  exit 1
fi

RUN_USER="${INVITE_MSG_API_USER:-}"
if [[ -z "$RUN_USER" ]]; then
  if [[ "$API_ROOT" == /root/* ]]; then
    RUN_USER=root
  elif id www &>/dev/null; then
    RUN_USER=www
  else
    RUN_USER=root
  fi
fi

RUN_GROUP="${INVITE_MSG_API_GROUP:-}"
if [[ -z "$RUN_GROUP" ]]; then
  RUN_GROUP="$(id -gn "$RUN_USER")"
fi

if [[ "$RUN_USER" != root ]]; then
  if ! sudo -u "$RUN_USER" test -r "$API_ROOT/.env" || ! sudo -u "$RUN_USER" test -r "$API_ROOT/src/server.js"; then
    echo "用户 $RUN_USER 无法读取 $API_ROOT，请：sudo chown -R $RUN_USER:$RUN_GROUP \"$API_ROOT\"" >&2
    exit 1
  fi
fi

cat >"$UNIT_DST" <<EOF
# 由 deploy/install-systemd.sh 生成，勿手改后丢失；需调整请改脚本参数后重新执行。
[Unit]
Description=Wedding invite messages API (SQLite + Express)
After=network.target

[Service]
Type=simple
WorkingDirectory=$API_ROOT
EnvironmentFile=$API_ROOT/.env
ExecStart=$NODE_BIN $API_ROOT/src/server.js
Restart=on-failure
RestartSec=5
User=$RUN_USER
Group=$RUN_GROUP

[Install]
WantedBy=multi-user.target
EOF

chmod 644 "$UNIT_DST"
systemctl daemon-reload
systemctl enable invite-messages-api.service
systemctl restart invite-messages-api.service
systemctl --no-pager -l status invite-messages-api.service || true
echo ""
echo "已安装并尝试启动。查看日志: journalctl -u invite-messages-api -f"
echo "健康检查: curl -sS http://127.0.0.1:3840/api/health （端口以 .env 的 PORT 为准）"
