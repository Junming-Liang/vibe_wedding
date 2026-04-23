const SITE_ROOT_MESSAGE_BRIDGE = "/invite-2026-messages-bridge.php";

type JsonEnvelope = {
  items?: unknown[];
  error?: string;
  detail?: string;
  upstream?: string;
  id?: number;
  ok?: boolean;
  honeypot?: boolean;
};

/** 留言/登记接口根路径（已含 `/api` 后缀），供直连 Node / Nginx 反代时使用 */
export function inviteApiRoot(): string {
  const raw = import.meta.env.VITE_MESSAGES_API as string | undefined;
  if (raw != null && String(raw).trim() !== "") {
    return String(raw).trim().replace(/\/+$/, "");
  }
  const base = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
  if (!base) return "/api";
  return `${base}/api`;
}

/**
 * 生产环境且未配置独立 API 时，默认走站点根 PHP 桥。
 * 设为 `false` 可强制走 /invite-2026/api/（需 Nginx 已反代到 Node）。
 */
export function usePhpBridge(): boolean {
  if (import.meta.env.VITE_MESSAGES_API?.trim()) return false;
  const flag = (import.meta.env.VITE_MESSAGES_USE_PHP_BRIDGE as string | undefined)?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "off") return false;
  if (import.meta.env.DEV) return false;
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return false;
  return true;
}

function absoluteUrl(path: string): string {
  if (typeof window === "undefined") return path;
  try {
    const p = path.startsWith("/") ? path : `/${path}`;
    return new URL(p, window.location.origin).href;
  } catch {
    return path;
  }
}

export function phpBridgeHref(action?: string): string {
  const url = absoluteUrl(SITE_ROOT_MESSAGE_BRIDGE);
  if (!action) return url;
  return `${url}?action=${encodeURIComponent(action)}`;
}

export function inviteApiEndpoint(suffix: string): string {
  const root = inviteApiRoot().replace(/\/+$/, "");
  const path = `${root}${suffix.startsWith("/") ? suffix : `/${suffix}`}`;
  if (typeof window === "undefined") return path;
  try {
    if (/^https?:\/\//i.test(path)) {
      return new URL(path).href;
    }
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return new URL(normalized, window.location.origin).href;
  } catch {
    return path.startsWith("/") ? path : `/${path}`;
  }
}

export function mapFetchError(err: unknown): string {
  if (err instanceof TypeError && /pattern|URL|Failed to fetch/i.test(err.message)) {
    return "网络或地址异常，请稍后再试（若持续出现请检查接口配置）。";
  }
  if (err instanceof Error) return err.message;
  return "请求失败";
}

export function parseJsonBody(text: string): JsonEnvelope | null {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as JsonEnvelope;
  } catch {
    return null;
  }
}

export function formatHttpJsonError(
  status: number,
  payload: JsonEnvelope | null,
  phpBridge: boolean,
  verb: "加载" | "提交" = "加载",
): string {
  if (payload?.error) {
    const bits = [payload.error];
    if (payload.upstream) bits.push(`请求地址：${payload.upstream}`);
    if (payload.detail) bits.push(`详情：${payload.detail}`);
    if (status === 502 && phpBridge) {
      bits.push(
        "请在服务器启动 Node 服务：cd invite_messages_api && npm install && npm run start；或配置 systemd（见 invite_messages_api/README.md）。php-fpm 环境变量 INVITE_MSG_UPSTREAM 须与 Node 监听地址一致（默认 http://127.0.0.1:3840）。",
      );
    }
    return bits.join(" ");
  }
  return `${verb}失败 (${status})`;
}
