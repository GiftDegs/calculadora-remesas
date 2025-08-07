const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use("/admin", express.static(path.join(__dirname, "public/admin")));
app.use(express.static(path.join(__dirname, "public")));

// Formatear tasas
function formatearTasa(v) {
  if (v >= 1) return parseFloat(v.toFixed(1));
  if (v >= 0.01) return parseFloat(v.toFixed(3));
  if (v >= 0.00099) return parseFloat(v.toFixed(5));
  return parseFloat(v.toFixed(6));
}

// Obtener snapshot actual
app.get("/api/snapshot", (req, res) => {
  const ruta = path.join(__dirname, "public", "snapshot.json");
  if (fs.existsSync(ruta)) {
    const data = fs.readFileSync(ruta, "utf8");
    res.json(JSON.parse(data));
  } else {
    res.json({});
  }
});

// Guardar snapshot y su historial
app.post("/api/guardar-snapshot", (req, res) => {
  const snapshotActualPath = path.join(__dirname, "public", "snapshot.json");
  const fecha = new Date().toISOString().slice(0, 10);
  const snapshotHistPath = path.join(__dirname, "public", "snapshots", `${fecha}.json`);
  const dirSnapshots = path.join(__dirname, "public", "snapshots");

  // 1. Leer snapshot anterior si existe
  let snapshotAnterior = {};
  if (fs.existsSync(snapshotActualPath)) {
    const raw = fs.readFileSync(snapshotActualPath, "utf8");
    snapshotAnterior = JSON.parse(raw);
  }

  // 2. Formatear solo las tasas nuevas recibidas
  const crucesNuevosFormateados = {};
  for (const key in req.body.cruces) {
    crucesNuevosFormateados[key] = formatearTasa(req.body.cruces[key]);
  }

  // 3. Combinar con los cruces anteriores que no fueron modificados
  const crucesCompletos = {
    ...snapshotAnterior.cruces,
    ...crucesNuevosFormateados
  };

  // 4. Armar nuevo snapshot completo
  const datosFinales = {
    ...snapshotAnterior,
    ...req.body,
    cruces: crucesCompletos,
    guardado_en: new Date().toISOString()
  };

  try {
    // Crear carpeta de snapshots históricos si no existe
    if (!fs.existsSync(dirSnapshots)) {
      fs.mkdirSync(dirSnapshots);
    }

    // Guardar snapshot actual
    fs.writeFileSync(snapshotActualPath, JSON.stringify(datosFinales, null, 2));
    console.log("💾 Snapshot actualizado");

    // Guardar snapshot histórico si no existe
    if (!fs.existsSync(snapshotHistPath)) {
      fs.writeFileSync(snapshotHistPath, JSON.stringify(datosFinales, null, 2));
      console.log("📦 Snapshot histórico guardado:", fecha);
    }

    res.json({ status: "ok" });
  } catch (err) {
    console.error("❌ Error al guardar snapshot:", err);
    res.status(500).json({ error: "Error al guardar snapshot" });
  }
});


// Obtener precios desde Binance
app.post("/api/binance", async (req, res) => {
  const { fiat, tradeType, page = 1, payTypes = [], transAmount } = req.body;

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
        orderColumn: "price"
      },
      { headers: { "Content-Type": "application/json" } }
    );
    res.json(data);
  } catch (error) {
    console.error("❌ Error al obtener precios de Binance:", error.message);
    res.status(500).json({ error: "Fallo conexión Binance" });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en: http://localhost:${PORT}`);
});
