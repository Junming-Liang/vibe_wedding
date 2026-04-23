import { useState, type FormEvent } from "react";
import {
  formatHttpJsonError,
  inviteApiEndpoint,
  mapFetchError,
  parseJsonBody,
  phpBridgeHref,
  usePhpBridge,
} from "./inviteApi";

type VisitForm = {
  name: string;
  phone: string;
  attendees: string;
};

async function submitVisit(body: { name: string; phone: string; attendees: number }): Promise<void> {
  const phpBridge = usePhpBridge();
  const url = phpBridge ? phpBridgeHref("visit_submit") : inviteApiEndpoint("/visits");
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
  const parsed = parseJsonBody(text);
  if (!res.ok) {
    if (res.status === 405) {
      throw new Error(
        phpBridge
          ? "登记失败 (405)：站点根 PHP 桥可能未部署或未被 PHP-FPM 执行。"
          : "登记失败 (405)：POST 未到达登记服务。请将 Nginx 配置 /invite-2026/api/ 反代到 Node，或按 README 部署站点根 PHP 桥。",
      );
    }
    throw new Error(formatHttpJsonError(res.status, parsed, phpBridge, "提交"));
  }
}

function normalizePhoneInput(raw: string): string {
  return raw.replace(/[^\d+\-()\s]/g, "").slice(0, 24);
}

export function InvitationResponse() {
  const [form, setForm] = useState<VisitForm>({ name: "", phone: "", attendees: "1" });
  const [submitting, setSubmitting] = useState(false);
  const [submitOk, setSubmitOk] = useState("");
  const [submitErr, setSubmitErr] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitOk("");
    setSubmitErr("");

    const name = form.name.trim();
    const phone = form.phone.trim();
    const attendees = Number(form.attendees);

    if (!name) {
      setSubmitErr("请填写来宾姓名");
      return;
    }
    if (!phone) {
      setSubmitErr("请填写联系电话");
      return;
    }
    if (!Number.isInteger(attendees) || attendees < 1 || attendees > 20) {
      setSubmitErr("参加宴席人数请填写 1 到 20 之间的整数");
      return;
    }

    setSubmitting(true);
    try {
      await submitVisit({ name: name.slice(0, 24), phone, attendees });
      setForm({ name: "", phone: "", attendees: "1" });
      setSubmitOk("已登记成功。如人数或联系方式有变化，可用同手机号再次提交覆盖更新。");
    } catch (err) {
      setSubmitErr(mapFetchError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card rsvp-card" aria-labelledby="rsvp-heading">
      <h2 id="rsvp-heading" className="card-title">
        宾客赴宴登记
      </h2>
      <p className="rsvp-intro">
        为方便席位安排，请留下姓名、电话和参加人数。若后续人数有变，可再次提交更新。
      </p>

      <form className="rsvp-form" noValidate onSubmit={onSubmit}>
        <label className="message-wall-label" htmlFor="visit-name">
          姓名
        </label>
        <input
          id="visit-name"
          type="text"
          className="message-wall-input"
          maxLength={24}
          value={form.name}
          onChange={(ev) => setForm((prev) => ({ ...prev, name: ev.target.value }))}
          placeholder="如：张三"
          autoComplete="name"
        />

        <label className="message-wall-label" htmlFor="visit-phone">
          电话
        </label>
        <input
          id="visit-phone"
          type="tel"
          className="message-wall-input"
          maxLength={24}
          value={form.phone}
          onChange={(ev) =>
            setForm((prev) => ({ ...prev, phone: normalizePhoneInput(ev.target.value) }))
          }
          placeholder="如：13800138000"
          autoComplete="tel"
          inputMode="tel"
        />

        <label className="message-wall-label" htmlFor="visit-attendees">
          参加宴席人数
        </label>
        <input
          id="visit-attendees"
          type="number"
          className="message-wall-input"
          min={1}
          max={20}
          step={1}
          value={form.attendees}
          onChange={(ev) => setForm((prev) => ({ ...prev, attendees: ev.target.value }))}
          placeholder="1"
          inputMode="numeric"
        />

        {submitOk ? <p className="message-wall-banner message-wall-banner--ok">{submitOk}</p> : null}
        {submitErr ? <p className="message-wall-banner message-wall-banner--err">{submitErr}</p> : null}

        <button type="submit" className="message-wall-submit" disabled={submitting}>
          {submitting ? "提交中…" : "提交赴宴登记"}
        </button>
      </form>
    </section>
  );
}
