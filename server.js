const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Config Gist (persistencia) ----------
const GIST_ID = process.env.GIST_ID;
const GIST_FILENAME = process.env.GIST_FILENAME || "snapshot.json";
const GH_TOKEN = process.env.GH_TOKEN;
const USE_GIST = !!(GIST_ID && GH_TOKEN);

// Auth opcional para guardar (solo si seteas ADMIN_KEY)
const ADMIN_KEY = process.env.ADMIN_KEY || null;

// ---------- Middlewares ----------
app.use(express.json({ limit: "1mb" })); // por si crece el payload
app.use("/admin", express.static(path.join(__dirname, "public/admin")));
app.use(express.static(path.join(__dirname, "public")));

// ---------- Utils ----------
function formatearTasa(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n >= 10) return +n.toFixed(1);
  if (n >= 1) return +n.toFixed(2);
  if (n >= 0.01) return +n.toFixed(3);
  if (n >= 0.001) return +n.toFixed(4);
  if (n >= 0.00099) return +n.toFixed(5);
  return +n.toFixed(6);
}

async function readGistSnapshot() {
  const { data } = await axios.get(`https://api.github.com/gists/${GIST_ID}`, {
    headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json" },
  });
  const file = data.files[GIST_FILENAME];
  if (!file || !file.content) return {};
  return JSON.parse(file.content);
}

async function writeGistSnapshot(obj) {
  await axios.patch(
    `https://api.github.com/gists/${GIST_ID}`,
    { files: { [GIST_FILENAME]: { content: JSON.stringify(obj, null, 2) } } },
    { headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json" } }
  );
}

// ---------- Rutas ----------
app.get("/healthz", (req, res) => res.send("ok"));

app.get("/api/snapshot", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    if (USE_GIST) {
      const snap = await readGistSnapshot();
      return res.json(snap);
    }
    // Fallback local (desarrollo)
    const ruta = path.join(__dirname, "public", "snapshot.json");
    if (!fs.existsSync(ruta)) return res.json({});
    const data = fs.readFileSync(ruta, "utf8");
    return res.json(JSON.parse(data));
  } catch (e) {
    console.error("❌ Leyendo snapshot:", e.message);
    return res.status(500).json({ error: "Error leyendo snapshot" });
  }
});

app.post("/api/guardar-snapshot", async (req, res) => {
  // Auth opcional
  if (ADMIN_KEY && req.headers["x-admin-key"] !== ADMIN_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const fecha = new Date().toISOString().slice(0, 10);

  // 1) Leer snapshot anterior (Gist o local)
  let snapshotAnterior = {};
  try {
    if (USE_GIST) snapshotAnterior = await readGistSnapshot();
    else {
      const p = path.join(__dirname, "public", "snapshot.json");
      if (fs.existsSync(p)) snapshotAnterior = JSON.parse(fs.readFileSync(p, "utf8"));
    }
  } catch (e) {
    console.warn("⚠️ Snapshot previo corrupto, regenerando:", e.message);
  }

  // 2) Formatear solo cruces nuevos
  const crucesNuevos = req.body?.cruces || {};
  const crucesNuevosFormateados = {};
  for (const k of Object.keys(crucesNuevos)) {
    const n = Number(crucesNuevos[k]);
    if (!Number.isFinite(n)) continue;
   crucesNuevosFormateados[k] = formatearTasa(n); // ✔️
}
  // 3) Merge con cruces anteriores
  const crucesCompletos = { ...(snapshotAnterior.cruces || {}), ...crucesNuevosFormateados };

  // 4) Datos finales
  const datosFinales = {
    ...snapshotAnterior,
    ...req.body,
    cruces: crucesCompletos,
    guardado_en: new Date().toISOString(),
  };

  // 5) Guardar (Gist o local con histórico)
  try {
    if (USE_GIST) {
      await writeGistSnapshot(datosFinales);
    } else {
      const snapshotActualPath = path.join(__dirname, "public", "snapshot.json");
      const dirSnapshots = path.join(__dirname, "public", "snapshots");
      const snapshotHistPath = path.join(dirSnapshots, `${fecha}.json`);
      if (!fs.existsSync(dirSnapshots)) fs.mkdirSync(dirSnapshots, { recursive: true });
      fs.writeFileSync(snapshotActualPath, JSON.stringify(datosFinales, null, 2));
      if (!fs.existsSync(snapshotHistPath)) {
        fs.writeFileSync(snapshotHistPath, JSON.stringify(datosFinales, null, 2));
      }
    }
    return res.json({ status: "ok" });
  } catch (err) {
    console.error("❌ Error al guardar snapshot:", err.message);
    return res.status(500).json({ error: "Error al guardar snapshot" });
  }
});

// ---- BINANCE con cache simple (TTL 45s) ----
const binanceCache = new Map();
const BINANCE_TTL_MS = 45 * 1000;

app.post("/api/binance", async (req, res) => {
  const { fiat, tradeType, page = 1, payTypes = [], transAmount } = req.body || {};
  if (!fiat || !tradeType) return res.status(400).json({ error: "Parámetros inválidos" });

  const key = `${fiat}|${tradeType}|${transAmount || ""}`;
  const now = Date.now();
  const cached = binanceCache.get(key);
  if (cached && now - cached.t < BINANCE_TTL_MS) {
    return res.json(cached.data);
  }

  try {
    const { data } = await axios.post(
      "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search",
      {
        page,
        rows: 20,
        payTypes,
        asset: "USDT",
        tradeType,
        fiat,
        transAmount,
        order: null,
        orderColumn: "price",
      },
      { headers: { "Content-Type": "application/json" } }
    );
    binanceCache.set(key, { t: now, data });
    return res.json(data);
  } catch (error) {
    console.error("❌ Binance:", error?.message);
    if (cached) return res.json(cached.data);
    return res.status(500).json({ error: "Fallo conexión Binance" });
  }
});

// ---- Start ----
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en: http://localhost:${PORT}`);
});
