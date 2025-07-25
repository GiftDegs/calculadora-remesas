const express = require('express');
const app = express();
const PORT = 3000;

// Middleware para archivos estáticos
app.use(express.static('public'));

// Endpoint de tasa
app.get('/api/tasa', (req, res) => {
  res.json({ valor: 0.116 }); // valor fijo de ejemplo
});

// Endpoint para actualizar tasa (simulado)
app.post('/api/actualizar-tasa', (req, res) => {
  const nuevaTasa = 0.116; // deberías conectarte a Binance u otra fuente real
  res.json({ valor: nuevaTasa });
});

// Inicia el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
