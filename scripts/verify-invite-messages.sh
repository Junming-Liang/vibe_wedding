#!/usr/bin/env bash
# 检查线上请柬留言通道：/api 是否误落到 SPA；PHP 桥是否可访问
set -euo pipefail
ORIGIN="${1:-https://jamilblog.top}"

echo "== GET ${ORIGIN}/invite-2026/api/messages/public (应 JSON；若返回 HTML 说明未反代到 Node) =="
code=$(curl -sS -o /tmp/invite-api-body.txt -w "%{http_code}" "${ORIGIN}/invite-2026/api/messages/public" || true)
echo "HTTP $code"
head -c 120 /tmp/invite-api-body.txt | tr '\n' ' '
echo
if head -1 /tmp/invite-api-body.txt | grep -q '<!DOCTYPE'; then
  echo "FAIL: 收到 HTML（多为 index.html），Nginx 未将 /invite-2026/api/ 反代到 Node。"
else
  echo "OK: 非 HTML 开头"
fi

echo
echo "== POST ${ORIGIN}/invite-2026/api/messages (405 表示 POST 落到静态规则) =="
code2=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "${ORIGIN}/invite-2026/api/messages" \
  -H "Content-Type: application/json" \
  -d '{"author":"","content":"probe","_hp":""}' || true)
echo "HTTP $code2"

echo
echo "== GET ${ORIGIN}/invite-2026-messages-bridge.php?action=public (站点根 PHP 桥；部署后应为 JSON) =="
code3=$(curl -sS -o /tmp/invite-bridge-body.txt -w "%{http_code}" "${ORIGIN}/invite-2026-messages-bridge.php?action=public" || true)
echo "HTTP $code3"
head -c 200 /tmp/invite-bridge-body.txt | tr '\n' ' '
echo
if head -1 /tmp/invite-bridge-body.txt 2>/dev/null | grep -q '<!DOCTYPE'; then
  echo "NOTE: 仍为 HTML 时说明尚未把 invite-2026-messages-bridge.php 拷到 WordPress 站点根。"
fi
