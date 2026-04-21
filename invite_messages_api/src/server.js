import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import Database from "better-sqlite3";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** 显式指向包根目录 .env，避免从其它 cwd 启动时读不到（systemd / 全局 node 常见） */
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const PORT = Number(process.env.PORT || 3840);
/** 默认仅监听本机，不对外网开放；确需对外监听时设 HOST=0.0.0.0（不推荐） */
const HOST = process.env.HOST || "127.0.0.1";

/** 包根（含 package.json、.env），相对 DATABASE_PATH 均相对此目录，避免 systemd / 手动启动 cwd 不同导致「写了库 A、后台看库 B」 */
const pkgRoot = path.join(__dirname, "..");
const rawDbPath = process.env.DATABASE_PATH && String(process.env.DATABASE_PATH).trim();
const dbPath = rawDbPath
  ? path.isAbsolute(rawDbPath)
    ? rawDbPath
    : path.resolve(pkgRoot, rawDbPath)
  : path.join(pkgRoot, "data", "messages.db");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
console.log("[invite_messages_api] SQLite:", dbPath);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    reviewed_at INTEGER,
    client_ip TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
`);

/** 管理接口仅允许环回（勿用 X-Forwarded-For 判断，防伪造）。经本机 Nginx 反代到 Node 时，对端仍为 127.0.0.1。 */
function requireLoopback(req, res, next) {
  const raw = req.socket.remoteAddress || "";
  const ok =
    raw === "127.0.0.1" ||
    raw === "::1" ||
    raw === "::ffff:127.0.0.1";
  if (!ok) {
    return res.status(403).json({
      error:
        "管理接口仅允许本机访问。请在服务器上打开 http://127.0.0.1:" +
        String(PORT) +
        "/admin.html，或使用 SSH 隧道。",
    });
  }
  next();
}

function normalizeAuthor(raw) {
  if (typeof raw !== "string") return "";
  const t = raw.trim().replace(/\s+/g, " ");
  return t.slice(0, 24);
}

/** @returns {string | null} null 表示不合法 */
function normalizeContent(raw) {
  if (typeof raw !== "string") return null;
  const t = raw.replace(/\r\n/g, "\n").trim();
  if (!t) return null;
  if (t.length > 200) return null;
  if (t.includes("\0")) return null;
  const nl = t.match(/\n/g);
  if (nl && nl.length > 8) return null;
  return t;
}

function clientIp(req) {
  const xf = (req.headers["x-forwarded-for"] || "").toString();
  const first = xf.split(",")[0].trim();
  if (first) return first.slice(0, 64);
  const ra = req.socket.remoteAddress;
  return typeof ra === "string" ? ra.slice(0, 64) : "";
}

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
      },
    },
  }),
);

const corsOrigins = (process.env.CORS_ORIGINS ||
  "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,https://jamilblog.top,https://www.jamilblog.top")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
  }),
);

app.use(express.json({ limit: "12kb" }));

/** express-rate-limit@5 兼容 Node 12；v7 起依赖包内含 ?. 无法在旧版 V8 上解析 */
function json429(res, msg) {
  res.status(429).json({ error: msg });
}

const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  handler: (req, res) => {
    json429(res, "提交过于频繁，请稍后再试");
  },
});

const publicReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  handler: (req, res) => {
    json429(res, "请求过于频繁，请稍后再试");
  },
});

const adminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 400,
  handler: (req, res) => {
    json429(res, "管理接口请求过于频繁");
  },
});

function mapAdminRow(r) {
  return {
    id: r.id,
    author: r.author,
    content: r.content,
    status: r.status,
    createdAt: new Date(r.created_at).toISOString(),
    reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : null,
    clientIp: r.client_ip || "",
  };
}

function adminPageUrlForDocs() {
  // 管理页仅环回可访问，对外返回可点的本机链接（与浏览器地址栏一致）
  return "http://127.0.0.1:" + String(PORT) + "/admin.html";
}

app.get("/api/health", (_req, res) => {
  const adminUrl = adminPageUrlForDocs();
  res.json({
    ok: true,
    adminUrl: adminUrl,
    admin: adminUrl,
    message: "管理审核页（本机浏览器打开）：" + adminUrl,
  });
});

app.get("/api/messages/public", publicReadLimiter, (_req, res) => {
  try {
    const rows = db
      .prepare(
        `SELECT id, author, content, reviewed_at AS approvedAt
         FROM messages
         WHERE status = 'approved'
         ORDER BY reviewed_at ASC, id ASC
         LIMIT 120`,
      )
      .all();
    res.json({
      items: rows.map((r) => ({
        id: r.id,
        author: r.author,
        content: r.content,
        approvedAt: r.approvedAt ? new Date(r.approvedAt).toISOString() : null,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "服务暂时不可用" });
  }
});

app.post("/api/messages", submitLimiter, (req, res) => {
  const body = req.body || {};
  const hp = body._hp;
  // 蜜罐：仅非空字符串视为机器人；避免 true/1 等异常 JSON 误伤
  if (typeof hp === "string" && hp.trim() !== "") {
    return res.status(201).json({ ok: true, id: 0, honeypot: true });
  }

  const author = normalizeAuthor(body.author);
  const content = normalizeContent(body.content);
  if (!content) {
    return res.status(400).json({ error: "留言内容无效或过长（最多 200 字）" });
  }

  const now = Date.now();
  const ip = clientIp(req);
  try {
    const info = db
      .prepare(
        `INSERT INTO messages (author, content, status, created_at, client_ip)
         VALUES (@author, @content, 'pending', @now, @ip)`,
      )
      .run({ author, content, now, ip });
    res.status(201).json({ ok: true, id: Number(info.lastInsertRowid) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "保存失败，请稍后再试" });
  }
});

app.get("/api/admin/messages", adminLimiter, requireLoopback, (req, res) => {
  const status = (req.query.status || "pending").toString();
  const allowed = ["pending", "approved", "rejected", "all"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: "无效的 status" });
  }
  let sql = `SELECT id, author, content, status, created_at, reviewed_at, client_ip FROM messages`;
  const params = [];
  if (status !== "all") {
    sql += ` WHERE status = ?`;
    params.push(status);
  }
  sql += ` ORDER BY created_at DESC LIMIT 500`;
  try {
    const rows = db.prepare(sql).all(...params);
    res.json({ items: rows.map(mapAdminRow) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "查询失败" });
  }
});

app.post("/api/admin/messages/:id/approve", adminLimiter, requireLoopback, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: "无效的 id" });
  }
  const now = Date.now();
  const r = db
    .prepare(
      `UPDATE messages SET status = 'approved', reviewed_at = @now
       WHERE id = @id AND status = 'pending'`,
    )
    .run({ now, id });
  if (r.changes === 0) {
    return res.status(404).json({ error: "未找到待审核留言或已处理" });
  }
  res.json({ ok: true });
});

app.post("/api/admin/messages/:id/reject", adminLimiter, requireLoopback, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: "无效的 id" });
  }
  const now = Date.now();
  const r = db
    .prepare(
      `UPDATE messages SET status = 'rejected', reviewed_at = @now
       WHERE id = @id AND status = 'pending'`,
    )
    .run({ now, id });
  if (r.changes === 0) {
    return res.status(404).json({ error: "未找到待审核留言或已处理" });
  }
  res.json({ ok: true });
});

app.delete("/api/admin/messages/:id", adminLimiter, requireLoopback, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: "无效的 id" });
  }
  try {
    const r = db.prepare("DELETE FROM messages WHERE id = ?").run(id);
    if (r.changes === 0) {
      return res.status(404).json({ error: "留言不存在" });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "删除失败" });
  }
});

/** 避免误输成 …:3840/admin（非法 URL）；正确为 …:3840/admin.html */
app.get(["/admin", "/admin/"], requireLoopback, (_req, res) => {
  res.redirect(302, "/admin.html");
});

const publicDir = path.join(__dirname, "..", "public");
if (fs.existsSync(publicDir)) {
  const staticMw = express.static(publicDir);
  app.use((req, res, next) => {
    if (req.path === "/admin.html") {
      return requireLoopback(req, res, () => staticMw(req, res, next));
    }
    return staticMw(req, res, next);
  });
}

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, HOST, () => {
  const adminUrl = adminPageUrlForDocs();
  console.log("[invite_messages_api] 监听 " + HOST + ":" + PORT);
  console.log("[invite_messages_api] 审核页 " + adminUrl + " （curl 见 GET /api/health）");
});
