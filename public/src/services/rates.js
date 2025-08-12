import { normalizarTimestamp } from '../core/utils.js';

async function fetchWithTimeout(url, { timeout = 10000 } = {}) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(id);
  }
}

export async function obtenerTasa(origen, destino) {
  try {
    const data = await fetchWithTimeout('/api/snapshot');
    const clave = `${origen}-${destino}`;
    return {
      tasa: data?.cruces?.[clave] ?? null,
      compra: Number(data?.[origen]?.compra) || null,
      fecha: normalizarTimestamp(data?.timestamp)
    };
  } catch (err) {
    console.error('Error al obtener tasa:', err);
    return { tasa: null, compra: null, fecha: null };
  }
}
