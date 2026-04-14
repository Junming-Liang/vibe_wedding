import "./App.css";

/** 集中改文案：姓名、时间、地点等（微信链接预览的 title/description/og:url 在 index.html，请同步修改） */
const INVITE = {
  coupleLine: "张三 & 李四",
  subtitle: "诚挚邀请您参加我们的婚礼",
  dateLine: "2026 年 6 月 18 日 · 星期六",
  timeLine: "仪式 11:18 开始",
  venueName: "某某酒店 · 百合厅",
  address: "某某市某某区某某路 88 号",
  note: "如遇行程变化，请提前告知，感谢理解。",
};

export default function App() {
  return (
    <div className="page">
      <header className="hero" aria-label="封面">
        <p className="eyebrow">Wedding Invitation</p>
        <h1 className="title">{INVITE.coupleLine}</h1>
        <p className="lead">{INVITE.subtitle}</p>
      </header>

      <main className="sections">
        <section className="card" aria-labelledby="when-heading">
          <h2 id="when-heading" className="card-title">
            时间
          </h2>
          <p className="card-line accent">{INVITE.dateLine}</p>
          <p className="card-line">{INVITE.timeLine}</p>
        </section>

        <section className="card" aria-labelledby="where-heading">
          <h2 id="where-heading" className="card-title">
            地点
          </h2>
          <p className="card-line accent">{INVITE.venueName}</p>
          <p className="card-line muted">{INVITE.address}</p>
          <a
            className="map-link"
            href="https://maps.apple.com/"
            target="_blank"
            rel="noreferrer"
          >
            打开地图导航
          </a>
        </section>

        <section className="card note" aria-label="备注">
          <p>{INVITE.note}</p>
        </section>
      </main>

      <footer className="footer">期待与您相见</footer>
    </div>
  );
}
