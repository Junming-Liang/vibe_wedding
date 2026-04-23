import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  formatHttpJsonError,
  inviteApiEndpoint,
  mapFetchError,
  parseJsonBody,
  phpBridgeHref,
  usePhpBridge,
} from "./inviteApi";

type PublicMessage = { id: number; author: string; content: string };

async function fetchPublic(): Promise<PublicMessage[]> {
  const url = usePhpBridge() ? phpBridgeHref("public") : inviteApiEndpoint("/messages/public");
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  } catch (e) {
    throw new Error(mapFetchError(e));
  }
  const text = await res.text();
  const ct = res.headers.get("content-type") || "";
  const parsed = parseJsonBody(text);

  if (!ct.includes("application/json") && !parsed?.items && !parsed?.error) {
    const hint = usePhpBridge()
      ? "未收到 JSON：请确认已将 invite-2026-messages-bridge.php 拷到站点根且 PHP 可执行。"
      : "未收到 JSON：多为 Nginx 未将 /invite-2026/api/ 反代到 Node，或改用站点根 PHP 桥（见 README）。";
    throw new Error(`加载失败 (${res.status})。${hint}`);
  }

  if (!res.ok) {
    throw new Error(formatHttpJsonError(res.status, parsed, usePhpBridge(), "加载"));
  }

  if (!parsed || !Array.isArray(parsed.items)) {
    throw new Error("加载失败：返回数据格式异常。");
  }
  return parsed.items;
}

async function submitMessage(body: {
  author: string;
  content: string;
  _hp: string;
}): Promise<void> {
  const url = usePhpBridge() ? phpBridgeHref("message_submit") : inviteApiEndpoint("/messages");
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(mapFetchError(e));
  }
  const text = await res.text();
  const parsed = parseJsonBody(text) as JsonEnvelope | null;

  if (!res.ok) {
    if (res.status === 405) {
      throw new Error(
        usePhpBridge()
          ? "提交失败 (405)：站点根 PHP 可能未部署或未被 PHP-FPM 执行。"
          : "提交失败 (405)：POST 未到达留言服务。请将 Nginx 配置 /invite-2026/api/ 反代到 Node，或按 README 部署站点根 PHP 桥。",
      );
    }
    if (res.status === 502 && parsed) {
      throw new Error(formatHttpJsonError(502, parsed, usePhpBridge(), "提交"));
    }
    throw new Error(parsed?.error || `提交失败 (${res.status})`);
  }

  if (parsed && (parsed.honeypot === true || parsed.id === 0)) {
    throw new Error(
      "留言未入库：隐藏防刷项被填写（常见于浏览器自动填表）。请清空页面底部「请勿填写」框后重试。",
    );
  }
}

export function MessageWall() {
  const [items, setItems] = useState<PublicMessage[]>([]);
  const [loadErr, setLoadErr] = useState("");
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  /** 非受控，避免扩展自动填表写入 React state 触发蜜罐假成功 */
  const hpRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitOk, setSubmitOk] = useState("");
  const [submitErr, setSubmitErr] = useState("");

  const load = useCallback(async () => {
    setLoadErr("");
    try {
      const list = await fetchPublic();
      setItems(list);
    } catch (e) {
      setLoadErr(mapFetchError(e));
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 45000);
    return () => window.clearInterval(id);
  }, [load]);

  const durationSec = useMemo(() => {
    const n = items.length;
    if (n <= 0) return 24;
    return Math.min(90, Math.max(28, n * 9));
  }, [items.length]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitOk("");
    setSubmitErr("");
    const t = content.trim();
    if (!t) {
      setSubmitErr("请填写祝福内容");
      return;
    }
    if (t.length > 200) {
      setSubmitErr("内容请控制在 200 字以内");
      return;
    }
    setSubmitting(true);
    try {
      await submitMessage({
        author: author.trim().slice(0, 24),
        content: t.slice(0, 200),
        _hp: hpRef.current ? String(hpRef.current.value || "") : "",
      });
      setContent("");
      setSubmitOk("已收到您的祝福，待新人审核后会显示在留言墙上。");
    } catch (err) {
      setSubmitErr(mapFetchError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card message-wall-card" aria-labelledby="wall-heading">
      <h2 id="wall-heading" className="card-title">
        祝福留言
      </h2>
      <p className="message-wall-intro">
        写下一句祝福；显示在墙上前会由新人后台审核，仅通过审核的留言会滚动展示。
      </p>

      {loadErr ? <p className="message-wall-banner message-wall-banner--err">{loadErr}</p> : null}

      <div className="message-wall-viewport" aria-label="已通过审核的留言滚动展示">
        {items.length > 0 ? (
          <div
            className="message-wall-track"
            style={{ animationDuration: `${durationSec}s` }}
            key={items.map((m) => m.id).join(",")}
          >
            {[...items, ...items].map((m, i) => (
              <span key={`${m.id}-${i}`} className="message-wall-chip">
                {m.author ? (
                  <>
                    <span className="message-wall-author">{m.author}</span>
                    <span className="message-wall-colon">：</span>
                  </>
                ) : null}
                <span className="message-wall-text">{m.content}</span>
                <span className="message-wall-dot" aria-hidden="true">
                  {" "}
                  ·{" "}
                </span>
              </span>
            ))}
          </div>
        ) : (
          <p className="message-wall-empty">{loadErr ? "" : "暂无展示的留言，欢迎成为第一位祝福的宾客。"}</p>
        )}
      </div>

      <form className="message-wall-form" noValidate onSubmit={onSubmit}>
        <label className="message-wall-label" htmlFor="msg-author">
          署名（选填）
        </label>
        <input
          id="msg-author"
          type="text"
          className="message-wall-input"
          maxLength={24}
          value={author}
          onChange={(ev) => setAuthor(ev.target.value)}
          placeholder="如：老同学 张三"
          autoComplete="off"
        />

        <label className="message-wall-label" htmlFor="msg-content">
          祝福内容
        </label>
        <textarea
          id="msg-content"
          className="message-wall-textarea"
          maxLength={200}
          rows={3}
          value={content}
          onChange={(ev) => setContent(ev.target.value)}
          placeholder="一句心意即可，最多 200 字"
        />
        <div className="message-wall-counter" aria-live="polite">
          {content.length}/200
        </div>

        {/* 蜜罐：正常用户不可见；自动填写该字段的脚本通常视为垃圾请求 */}
        <div className="message-wall-hp" aria-hidden="true">
          <label htmlFor="msg-hp">请勿填写</label>
          <input
            id="msg-hp"
            ref={hpRef}
            type="text"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </div>

        {submitOk ? <p className="message-wall-banner message-wall-banner--ok">{submitOk}</p> : null}
        {submitErr ? <p className="message-wall-banner message-wall-banner--err">{submitErr}</p> : null}

        <button type="submit" className="message-wall-submit" disabled={submitting}>
          {submitting ? "提交中…" : "提交祝福"}
        </button>
      </form>
    </section>
  );
}
