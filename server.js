const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware estático y JSON
app.use(express.json());
app.use("/admin", express.static(path.join(__dirname, "public/admin")));
app.use(express.static(path.join(__dirname, "public")));

// ---- Utilidades ----
function formatearTasa(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n >= 1) return +n.toFixed(1);
  if (n >= 0.01) return +n.toFixed(3);
  if (n >= 0.00099) return +n.toFixed(5);
  return +n.toFixed(6);
}

// ---- SNAPSHOT ----
app.get("/api/snapshot", (req, res) => {
  const ruta = path.join(__dirname, "public", "snapshot.json");
  res.set("Cache-Control", "no-store"); // evita cache viejo del navegador
  if (!fs.existsSync(ruta)) return res.json({});

  try {
    const data = fs.readFileSync(ruta, "utf8");
    return res.json(JSON.parse(data));
  } catch (e) {
    console.error("❌ Leyendo snapshot:", e.message);
    return res.status(500).json({ error: "Error leyendo snapshot" });
  }
});

app.post("/api/guardar-snapshot", (req, res) => {
  const snapshotActualPath = path.join(__dirname, "public", "snapshot.json");
  const fecha = new Date().toISOString().slice(0, 10);
  const dirSnapshots = path.join(__dirname, "public", "snapshots");
  const snapshotHistPath = path.join(dirSnapshots, `${fecha}.json`);

  // Leer snapshot anterior si existe
  let snapshotAnterior = {};
  if (fs.existsSync(snapshotActualPath)) {
    try {
      snapshotAnterior = JSON.parse(fs.readFileSync(snapshotActualPath, "utf8"));
    } catch (e) {
      console.warn("⚠️ Snapshot previo corrupto, regenerando:", e.message);
    }
  }

  // Formatear solo cruces nuevos
  const crucesNuevos = req.body?.cruces || {};
  const crucesNuevosFormateados = {};
  for (const k of Object.keys(crucesNuevos)) {
    const f = formatearTasa(crucesNuevos[k]);
    if (f != null) crucesNuevosFormateados[k] = f;
  }

  // Merge con cruces anteriores
  const crucesCompletos = { ...(snapshotAnterior.cruces || {}), ...crucesNuevosFormateados };

  // Armar snapshot final
  const datosFinales = {
    ...snapshotAnterior,
    ...req.body,
    cruces: crucesCompletos,
    guardado_en: new Date().toISOString(),
  };

  try {
    if (!fs.existsSync(dirSnapshots)) fs.mkdirSync(dirSnapshots, { recursive: true });

    fs.writeFileSync(snapshotActualPath, JSON.stringify(datosFinales, null, 2));
    console.log("💾 Snapshot actualizado");

    if (!fs.existsSync(snapshotHistPath)) {
      fs.writeFileSync(snapshotHistPath, JSON.stringify(datosFinales, null, 2));
      console.log("📦 Snapshot histórico guardado:", fecha);
    }

    return res.json({ status: "ok" });
  } catch (err) {
    console.error("❌ Error al guardar snapshot:", err.message);
    return res.status(500).json({ error: "Error al guardar snapshot" });
  }
});

// ---- BINANCE con cache simple (TTL 45s) ----
const binanceCache = new Map(); // key: `${fiat}|${tradeType}`
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

    // cachear
    binanceCache.set(key, { t: now, data });
    return res.json(data);
  } catch (error) {
    console.error("❌ Binance:", error?.message);
    // fallback si existía cache viejo
    if (cached) return res.json(cached.data);
    return res.status(500).json({ error: "Fallo conexión Binance" });
  }
});

// ---- Login (opcional; por ahora solo retorna token fake) ----
app.post("/api/login", (req, res) => {
  // Mantengo este endpoint porque tu admin lo usa, pero sin validar nada todavía.
  return res.json({ token: "ok" });
});

// ---- Start ----
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en: http://localhost:${PORT}`);
});
