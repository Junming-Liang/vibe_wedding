import { useCallback, useState, type ChangeEvent, type FormEvent } from "react";
import {
  formatHttpJsonError,
  inviteActionEndpoint,
  mapFetchError,
  requestJsonEnvelope,
} from "./inviteApi";

type VisitForm = {
  name: string;
  phone: string;
  attendees: string;
};

const INITIAL_VISIT_FORM: VisitForm = { name: "", phone: "", attendees: "1" };

async function submitVisit(body: { name: string; phone: string; attendees: number }): Promise<void> {
  const { url, phpBridge } = inviteActionEndpoint("visitSubmit");
  const { response, payload } = await requestJsonEnvelope(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    if (response.status === 405) {
      throw new Error(
        phpBridge
          ? "登记失败 (405)：站点根 PHP 桥可能未部署或未被 PHP-FPM 执行。"
          : "登记失败 (405)：POST 未到达登记服务。请将 Nginx 配置 /invite-2026/api/ 反代到 Node，或按 README 部署站点根 PHP 桥。",
      );
    }
    if (response.status === 404 && payload?.error === "Not found") {
      throw new Error(
        "登记接口返回 404：服务器上的留言 API（invite_messages_api）版本过旧或未重启，尚不支持赴宴人数登记。请在部署机拉取最新代码后执行 npm install（必要时 npm rebuild）、再 systemctl restart 对应服务，并确认已部署含 visit_submit 的站点根 PHP 桥。",
      );
    }
    throw new Error(formatHttpJsonError(response.status, payload, phpBridge, "提交"));
  }
}

function normalizePhoneInput(raw: string): string {
  return raw.replace(/[^\d+\-()\s]/g, "").slice(0, 24);
}

export function InvitationResponse() {
  const [form, setForm] = useState<VisitForm>(INITIAL_VISIT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitOk, setSubmitOk] = useState("");
  const [submitErr, setSubmitErr] = useState("");

  const onNameChange = useCallback((ev: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, name: ev.target.value }));
  }, []);

  const onPhoneChange = useCallback((ev: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, phone: normalizePhoneInput(ev.target.value) }));
  }, []);

  const onAttendeesChange = useCallback((ev: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, attendees: ev.target.value }));
  }, []);

  const onSubmit = useCallback(async (e: FormEvent) => {
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
      setForm(INITIAL_VISIT_FORM);
      setSubmitOk("已登记成功。如人数或联系方式有变化，可用同手机号再次提交覆盖更新。");
    } catch (err) {
      setSubmitErr(mapFetchError(err));
    } finally {
      setSubmitting(false);
    }
  }, [form.attendees, form.name, form.phone]);

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
          onChange={onNameChange}
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
          onChange={onPhoneChange}
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
          onChange={onAttendeesChange}
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
