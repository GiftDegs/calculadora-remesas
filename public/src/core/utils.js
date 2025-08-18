export const userLocale = navigator.language || 'es-ES';

export function normalizarTimestamp(ts) {
  if (!ts) return null;
  const n = Number(ts);
  if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n;
  const parsed = Date.parse(ts);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatearFecha(timestamp) {
  if (!timestamp) return 'hoy';
  const d = new Date(timestamp);
  if (isNaN(d)) return 'hoy';
  return d.toLocaleDateString(userLocale, { day: '2-digit', month: 'long', year: 'numeric' });
}

export function formatearTasa(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  if (n >= 10) return n.toFixed(1);
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.1) return n.toFixed(3);
  if (n >= 0.01) return n.toFixed(4);
  if (n >= 0.001) return n.toFixed(5);
  return n.toFixed(6);
}

export function redondearPorMoneda(valor, moneda) {
  let unidadRedondeo = 1;
  switch (moneda) {
    case 'ARS':
    case 'COP':
    case 'CLP':
      unidadRedondeo = 100; break;
    case 'VES':
    case 'MXN':
    case 'PEN':
    case 'BRL':
      unidadRedondeo = 1; break;
  }
  if (valor < unidadRedondeo) return Math.round(valor);
  const resto = valor % unidadRedondeo;
  return resto >= unidadRedondeo / 2 ? valor + (unidadRedondeo - resto) : valor - resto;
}
