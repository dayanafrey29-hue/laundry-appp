import express from "express";
import cors from "cors";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app = express();
import path from 'path';
app.use(express.static('dist'));
app.use(cors());
app.use(express.json({ limit: "50mb" }));

const KEYS = ["records", "apts", "maids", "linen"];

const sseClients = new Set();;'';`

// ─── SSE endpoint ────────────────────────────────────────────────
app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const heartbeat = setInterval(() => {
    res.write(": ping\n\n");
  }, 25000);

  sseClients.add(res);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

function broadcast(key, value) {
  const payload = JSON.stringify({ key, value });
  for (const client of sseClients) {
    client.write(`data: ${payload}\n\n`);
  }
}

// ─── GET all data ────────────────────────────────────────────────
app.get("/api/data", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT key, value FROM laundry_store WHERE key = ANY($1)", [KEYS]);
    const data = {};
    for (const row of rows) {
      try { data[row.key] = JSON.parse(row.value); } catch { data[row.key] = row.value; }
    }
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST save one key ───────────────────────────────────────────
app.post("/api/sync", async (req, res) => {
  const { key, value } = req.body;
  if (!KEYS.includes(key)) return res.status(400).json({ ok: false, error: "unknown key" });
  const json = JSON.stringify(value);
  try {
    await pool.query(
      `INSERT INTO laundry_store (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, json]
    );
    broadcast(key, value);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => console.log(`API server on :${PORT}`));
