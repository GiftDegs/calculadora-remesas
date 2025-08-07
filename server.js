const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const app = express();
const PORT = 3000;
const SECRET_KEY = "bytetransfer_super_secreto_2025";

app.use(express.json());

// Formatear tasas
function formatearTasa(v) {
  if (v >= 1) return parseFloat(v.toFixed(1));
  if (v >= 0.01) return parseFloat(v.toFixed(3));
  if (v >= 0.00099) return parseFloat(v.toFixed(5));
  return parseFloat(v.toFixed(6));
}

// API: Login
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const usuariosPath = path.join(__dirname, "public", "usuarios.json");

  const users = JSON.parse(fs.readFileSync(usuariosPath, "utf8"));
  const user = users.find(u => u.email === email);

  if (!user) return res.status(401).json({ error: "Usuario no encontrado" });

  const claveCoincide = bcrypt.compareSync(password, user.passwordHash);
  if (!claveCoincide) return res.status(401).json({ error: "Contraseña incorrecta" });

  const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: "2h" });
  res.json({ token });
});

// Middleware de autenticación
function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(403).json({ error: "Token requerido" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.usuario = decoded;
    next();
  } catch {
    return res.status(403).json({ error: "Token inválido o expirado" });
  }
}

// Ruta protegida
app.get("/api/perfil", verificarToken, (req, res) => {
  res.json({ mensaje: "Accediste al perfil privado", usuario: req.usuario });
});

// Snapshot
app.get("/api/snapshot", (req, res) => {
  const ruta = path.join(__dirname, "public", "snapshot.json");
  if (fs.existsSync(ruta)) {
    const data = fs.readFileSync(ruta, "utf8");
    res.json(JSON.parse(data));
  } else {
    res.json({});
  }
});

app.post("/api/guardar-snapshot", verificarToken, (req, res) => {
  const snapshotActualPath = path.join(__dirname, "public", "snapshot.json");
  const fecha = new Date().toISOString().slice(0, 10);
  const snapshotHistPath = path.join(__dirname, "public", "snapshots", `${fecha}.json`);

  const crucesFormateados = {};
  for (const key in req.body.cruces) {
    crucesFormateados[key] = formatearTasa(req.body.cruces[key]);
  }

  const datos = {
    ...req.body,
    cruces: crucesFormateados,
    guardado_en: new Date().toISOString()
  };

  const dirSnapshots = path.join(__dirname, "public", "snapshots");
  if (!fs.existsSync(dirSnapshots)) {
    fs.mkdirSync(dirSnapshots);
  }

  fs.writeFileSync(snapshotActualPath, JSON.stringify(datos, null, 2));
  console.log("📁 Snapshot actualizado");

  if (!fs.existsSync(snapshotHistPath)) {
    fs.writeFileSync(snapshotHistPath, JSON.stringify(datos, null, 2));
    console.log("📦 Snapshot histórico guardado:", fecha);
  }

  res.json({ status: "ok" });
});

// Binance
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

// Archivos estáticos
app.use("/admin", express.static(path.join(__dirname, "public/admin")));
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en: http://localhost:${PORT}`);
});
