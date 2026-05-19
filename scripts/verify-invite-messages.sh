#!/usr/bin/env bash
# 检查线上请柬留言通道：/api 是否误落到 SPA；PHP 桥是否可访问。
set -euo pipefail

ORIGIN="${1:-https://jamilblog.top}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

api_body="$TMP_DIR/invite-api-body.txt"
bridge_body="$TMP_DIR/invite-bridge-body.txt"
visit_body="$TMP_DIR/invite-visit-body.txt"

section() {
  echo
  echo "== $1 =="
}

preview_body() {
  local file="$1"
  local bytes="${2:-200}"
  head -c "$bytes" "$file" 2>/dev/null | tr '\n' ' '
  echo
}

starts_with_html() {
  head -1 "$1" 2>/dev/null | grep -q '<!DOCTYPE'
}

request_code() {
  local output="$1"
  shift
  curl -sS -o "$output" -w "%{http_code}" "$@" || true
}

section "GET ${ORIGIN}/invite-2026/api/messages/public (应 JSON；若返回 HTML 说明未反代到 Node)"
code="$(request_code "$api_body" "${ORIGIN}/invite-2026/api/messages/public")"
echo "HTTP $code"
preview_body "$api_body" 120
if starts_with_html "$api_body"; then
  echo "FAIL: 收到 HTML（多为 index.html），Nginx 未将 /invite-2026/api/ 反代到 Node。"
else
  echo "OK: 非 HTML 开头"
fi

section "POST ${ORIGIN}/invite-2026/api/messages (405 表示 POST 落到静态规则)"
code2="$(request_code /dev/null -X POST "${ORIGIN}/invite-2026/api/messages" \
  -H "Content-Type: application/json" \
  -d '{"author":"","content":"probe","_hp":""}')"
echo "HTTP $code2"

section "GET ${ORIGIN}/invite-2026-messages-bridge.php?action=public (站点根 PHP 桥；部署后应为 JSON)"
code3="$(request_code "$bridge_body" "${ORIGIN}/invite-2026-messages-bridge.php?action=public")"
echo "HTTP $code3"
preview_body "$bridge_body" 200
if starts_with_html "$bridge_body"; then
  echo "NOTE: 仍为 HTML 时说明尚未把 invite-2026-messages-bridge.php 拷到 WordPress 站点根。"
fi

section "POST ${ORIGIN}/invite-2026-messages-bridge.php?action=visit_submit (201 正常；404+Not found 表示 Node 未更新或未重启，缺 POST /api/visits)"
code4="$(request_code "$visit_body" -X POST "${ORIGIN}/invite-2026-messages-bridge.php?action=visit_submit" \
  -H "Content-Type: application/json" \
  -d '{"name":"verify-script","phone":"19900008888","attendees":1}')"
echo "HTTP $code4"
preview_body "$visit_body" 200
if [[ "$code4" == "404" ]] && grep -q '"Not found"' "$visit_body" 2>/dev/null; then
  echo "FAIL: 上游 Node 无赴宴登记接口。请在服务器更新 invite_messages_api 并重启服务。"
fi
