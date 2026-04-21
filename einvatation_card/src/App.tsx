import { useCallback, useEffect, useRef, useState } from "react";
import weddingPhotoSrc from "./assets/mogo_weding_picture.png";
import { MessageWall } from "./MessageWall";
import "./App.css";

/** 集中改文案；微信链接预览请同步改 index.html */
const INVITE = {
  groom: "梁隽铭",
  bride: "韩姝敏",
  subtitle: "喜结良缘 · 敬备喜筵",
  dateLine: "2026 年 10 月 3 日 · 星期六",
  timeLine: "11:18 吉时开席",
  /** 倒计时终点（与良辰一致，东八区） */
  eventAt: "2026-10-03T11:18:00+08:00",
  venueName: "御海楼（昆区店）宴会接待中心",
  addressFull: "内蒙古包头市昆都仑区御海楼（昆区店）宴会接待中心",
  note: "您的到来是最好的祝福。若行程有变，请提前告知，感谢理解。",
};

type CountdownParts = { days: number; hours: number; minutes: number; seconds: number };

function parseCountdown(targetMs: number, nowMs: number): CountdownParts | null {
  const diff = targetMs - nowMs;
  if (diff <= 0) return null;
  const totalSec = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** 仓库主页（请柬页底开源说明用） */
const REPO_URL = "https://github.com/Junming-Liang/vibe_wedding";

const MAP_KEYWORD = "御海楼昆区店宴会接待中心";
const MAP_GAODE = `https://uri.amap.com/search?keyword=${encodeURIComponent(MAP_KEYWORD)}&city=${encodeURIComponent("包头")}&coordinate=gaode&callnative=1`;
const MAP_BAIDU = `https://map.baidu.com/search?querytype=s&wd=${encodeURIComponent(INVITE.addressFull)}`;

const BGM_SRC = `${import.meta.env.BASE_URL || "/"}bgm.mp3`;

function bgmAbsoluteUrl(): string {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
  return new URL(`${base}bgm.mp3`, window.location.origin).toString();
}

type WxBridge = { invoke: (api: string, data: object, cb: () => void) => void };

function getWeixinJSBridge(): WxBridge | undefined {
  return (window as unknown as { WeixinJSBridge?: WxBridge }).WeixinJSBridge;
}

/** 微信内走 JSBridge；500ms 超时兜底必调用一次 play，避免回调不触发 */
function playAudioRobust(a: HTMLAudioElement): Promise<void> {
  const prep = () => {
    a.volume = 1;
    a.muted = false;
  };
  const tryPlay = () => {
    prep();
    return a.play();
  };

  return tryPlay().catch((directErr) => {
    prep();
    const ua = navigator.userAgent || "";
    if (!/MicroMessenger/i.test(ua)) {
      throw directErr;
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (p: Promise<void>) => {
        if (settled) return;
        settled = true;
        void p.then(resolve).catch(reject);
      };

      const retryByBridge = () => {
        const bridge = getWeixinJSBridge();
        if (!bridge) {
          reject(directErr);
          return;
        }
        try {
          bridge.invoke("getNetworkType", {}, () => finish(tryPlay()));
        } catch {
          finish(tryPlay());
        }
      };

      if (getWeixinJSBridge()) {
        retryByBridge();
        return;
      }

      document.addEventListener("WeixinJSBridgeReady", retryByBridge, { once: true });
      window.setTimeout(() => {
        if (!settled) {
          finish(tryPlay());
        }
      }, 520);
    });
  });
}

export default function App() {
  const [copied, setCopied] = useState(false);
  const [bgmOn, setBgmOn] = useState(false);
  const [bgmError, setBgmError] = useState("");
  const [countdown, setCountdown] = useState<CountdownParts | null>(() => {
    const t = new Date(INVITE.eventAt).getTime();
    return Number.isFinite(t) ? parseCountdown(t, Date.now()) : null;
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const targetMs = new Date(INVITE.eventAt).getTime();
    if (!Number.isFinite(targetMs)) {
      setCountdown(null);
      return;
    }
    const tick = () => setCountdown(parseCountdown(targetMs, Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.setAttribute("playsinline", "true");
    a.setAttribute("webkit-playsinline", "true");
    a.setAttribute("x5-playsinline", "true");
    a.volume = 1;
    a.muted = false;
    const sync = () => setBgmOn(!a.paused);
    const onError = () => {
      const mediaError = a.error;
      const code = mediaError?.code;
      const detail =
        code === 1
          ? "播放被中止"
          : code === 2
            ? "网络错误"
            : code === 3
              ? "音频解码失败"
              : code === 4
                ? "音频资源不可用"
                : "音频加载失败";
      setBgmError(`背景音乐播放失败：${detail}`);
      setBgmOn(false);
    };
    a.addEventListener("play", sync);
    a.addEventListener("pause", sync);
    a.addEventListener("error", onError);
    return () => {
      a.removeEventListener("play", sync);
      a.removeEventListener("pause", sync);
      a.removeEventListener("error", onError);
    };
  }, []);

  const toggleBgm = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;

    if (!a.paused) {
      a.pause();
      setBgmOn(false);
      setBgmError("");
      return;
    }

    a.src = bgmAbsoluteUrl();
    setBgmError("");

    void playAudioRobust(a)
      .then(() => {
        setBgmOn(!a.paused);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "浏览器阻止了播放";
        setBgmOn(false);
        setBgmError(`背景音乐播放失败：${message}`);
      });
  }, []);

  const copyAddress = useCallback(async () => {
    const text = INVITE.addressFull;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        window.prompt("请长按复制地址：", text);
      }
    }
  }, []);

  return (
    <div className="page">
      <audio
        ref={audioRef}
        className="bgm-audio-hidden"
        loop
        playsInline
        preload="auto"
        src={BGM_SRC}
        aria-hidden="true"
      />

      <button
        type="button"
        className={`bgm-fab ${bgmOn ? "bgm-fab--on" : ""}`}
        onClick={toggleBgm}
        aria-pressed={bgmOn}
        aria-label={bgmOn ? "暂停背景音乐" : "播放背景音乐"}
      >
        <span className="bgm-fab__glyph" aria-hidden="true">
          {bgmOn ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="3" y="3" width="3.5" height="10" rx="1" />
              <rect x="9.5" y="3" width="3.5" height="10" rx="1" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2.5L13 8 4 13.5z" />
            </svg>
          )}
        </span>
        <span className="bgm-fab__label">{bgmOn ? "暂停" : "音乐"}</span>
      </button>

      <header className="hero" aria-label="封面">
        <p className="eyebrow">Wedding Invitation</p>
        <h1 className="title title--couple">
          <span className="name">{INVITE.groom}</span>
          <span className="name-join" aria-hidden="true">
            &
          </span>
          <span className="name">{INVITE.bride}</span>
        </h1>
        <p className="lead">{INVITE.subtitle}</p>
        <div
          className="countdown-bar"
          role="timer"
          aria-label={
            countdown
              ? `距开席还有 ${countdown.days} 天 ${countdown.hours} 小时 ${countdown.minutes} 分 ${countdown.seconds} 秒`
              : "良辰已到"
          }
        >
          {countdown ? (
            <>
              <span className="countdown-bar__label">距开席</span>
              <span className="countdown-bar__sep" aria-hidden="true">
                ·
              </span>
              <span className="countdown-bar__vals">
                <span className="countdown-pair">
                  <span className="countdown-pair__num">{countdown.days}</span>
                  <span className="countdown-pair__unit">天</span>
                </span>
                <span className="countdown-pair">
                  <span className="countdown-pair__num">{pad2(countdown.hours)}</span>
                  <span className="countdown-pair__unit">时</span>
                </span>
                <span className="countdown-pair">
                  <span className="countdown-pair__num">{pad2(countdown.minutes)}</span>
                  <span className="countdown-pair__unit">分</span>
                </span>
                <span className="countdown-pair">
                  <span className="countdown-pair__num">{pad2(countdown.seconds)}</span>
                  <span className="countdown-pair__unit">秒</span>
                </span>
              </span>
            </>
          ) : (
            <span className="countdown-bar__done">良辰已到，盼与您相逢</span>
          )}
        </div>
        {bgmError ? <p className="bgm-error">{bgmError}</p> : null}
      </header>

      <main className="sections">
        <section className="card photo-card" aria-labelledby="photo-heading">
          <h2 id="photo-heading" className="card-title">
            结婚照
          </h2>
          <figure className="wedding-photo-wrap">
            <img
              className="wedding-photo"
              src={weddingPhotoSrc}
              width={1024}
              height={1024}
              alt={`${INVITE.groom}与${INVITE.bride}的结婚照`}
              loading="lazy"
              decoding="async"
            />
            <figcaption className="wedding-photo-caption">囍 · 留作纪念</figcaption>
          </figure>
        </section>

        <section className="card" aria-labelledby="when-heading">
          <h2 id="when-heading" className="card-title">
            良辰
          </h2>
          <p className="card-line accent">{INVITE.dateLine}</p>
          <p className="card-line">{INVITE.timeLine}</p>
        </section>

        <section className="card" aria-labelledby="where-heading">
          <h2 id="where-heading" className="card-title">
            地点
          </h2>
          <p className="card-line accent">{INVITE.venueName}</p>
          <p className="card-line muted">{INVITE.addressFull}</p>
          <div className="nav-actions">
            <div className="nav-row">
              <a className="map-link" href={MAP_GAODE} rel="noopener">
                高德地图
              </a>
              <a className="map-link map-link--gold" href={MAP_BAIDU} rel="noopener">
                百度地图
              </a>
            </div>
            <button type="button" className="copy-btn" onClick={copyAddress}>
              {copied ? "已复制地址 ✓" : "复制完整地址"}
            </button>
            <p className="nav-hint">
              若未唤起 App，将在地图网页打开；可先复制地址到地图里搜索。
            </p>
          </div>
        </section>

        <section className="card note" aria-label="备注">
          <p>{INVITE.note}</p>
        </section>

        <MessageWall />
      </main>

      <footer className="page-foot" aria-label="页脚">
        <p className="footer">恭候您的光临</p>
        <div className="oss-note" aria-label="开源说明">
          <p className="oss-note__text">
            请柬为新郎新娘自己开发，已开源至Github仓库{" "}
            <a className="oss-note__link" href={REPO_URL} rel="noopener noreferrer">
              vibe_wedding
            </a>
            ，欢迎Star Fork PR
          </p>
        </div>
      </footer>
    </div>
  );
}
