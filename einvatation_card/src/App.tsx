import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

/** 集中改文案；微信链接预览请同步改 index.html */
const INVITE = {
  groom: "梁隽铭",
  bride: "韩姝敏",
  subtitle: "喜结良缘 · 敬备喜筵",
  dateLine: "2026 年 10 月 3 日 · 星期六",
  timeLine: "11:18 吉时开席",
  venueName: "御海楼（昆区店）宴会接待中心",
  addressFull: "内蒙古包头市昆都仑区御海楼（昆区店）宴会接待中心",
  note: "您的到来是最好的祝福。若行程有变，请提前告知，感谢理解。",
};

const MAP_KEYWORD = "御海楼昆区店宴会接待中心";
const MAP_GAODE = `https://uri.amap.com/search?keyword=${encodeURIComponent(MAP_KEYWORD)}&city=${encodeURIComponent("包头")}&coordinate=gaode&callnative=1`;
const MAP_BAIDU = `https://map.baidu.com/search?querytype=s&wd=${encodeURIComponent(INVITE.addressFull)}`;

const BGM_HINT = "《红颜劫》· 甄嬛传主题曲";

function bgmAbsoluteUrl(): string {
  const base = (import.meta.env.BASE || "/").replace(/\/?$/, "/");
  return `${window.location.origin}${base}bgm.mp3`;
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

  return new Promise((resolve, reject) => {
    let settled = false;
    const once = (p: Promise<void>) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(hardTimer);
      void p.then(resolve).catch(reject);
    };

    const hardTimer = window.setTimeout(() => once(tryPlay()), 520);

    prep();
    const ua = navigator.userAgent || "";
    if (!/MicroMessenger/i.test(ua)) {
      once(tryPlay());
      return;
    }

    const b = getWeixinJSBridge();
    if (b) {
      try {
        b.invoke("getNetworkType", {}, () => once(tryPlay()));
      } catch {
        once(tryPlay());
      }
      return;
    }

    document.addEventListener(
      "WeixinJSBridgeReady",
      () => {
        const b2 = getWeixinJSBridge();
        if (b2) {
          try {
            b2.invoke("getNetworkType", {}, () => once(tryPlay()));
          } catch {
            once(tryPlay());
          }
        } else {
          once(tryPlay());
        }
      },
      { once: true }
    );
  });
}

export default function App() {
  const [copied, setCopied] = useState(false);
  const [bgmOn, setBgmOn] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.setAttribute("playsinline", "true");
    a.setAttribute("webkit-playsinline", "true");
    a.setAttribute("x5-playsinline", "true");
    const sync = () => setBgmOn(!a.paused);
    a.addEventListener("play", sync);
    a.addEventListener("pause", sync);
    return () => {
      a.removeEventListener("play", sync);
      a.removeEventListener("pause", sync);
    };
  }, []);

  const toggleBgm = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;

    if (!a.paused) {
      a.pause();
      setBgmOn(false);
      return;
    }

    if (!a.src) {
      a.src = bgmAbsoluteUrl();
      a.load();
    }

    void playAudioRobust(a)
      .then(() => {
        window.setTimeout(() => {
          if (a.paused) {
            void a.play().catch(() => {});
          }
          setBgmOn(!a.paused);
        }, 120);
      })
      .catch(() => setBgmOn(false));
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
        preload="metadata"
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
        <p className="bgm-hint">{BGM_HINT}</p>
      </header>

      <main className="sections">
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
      </main>

      <footer className="footer">恭候您的光临</footer>
    </div>
  );
}
