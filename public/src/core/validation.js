import { CONFIG } from './config.js';
import { calcularCruce } from './fx.js';

export function validarMonto({ mode, tasa, tasaCompraUSD, origen, destino, monto }) {
  if (!mode || !Number.isFinite(tasaCompraUSD)) {
    return { ok: false, reason: 'NOT_READY' };
  }
  const t = Number(tasa);
  if (!Number.isFinite(monto) || monto <= 0) return { ok: false, reason: 'INVALID_AMOUNT' };
  if (!Number.isFinite(t) || t <= 0) return { ok: false, reason: 'INVALID_RATE' };

  const aPesosOrigen = mode === 'enviar'
    ? monto
    : calcularCruce(origen, destino, mode, monto, t);

  const usd = aPesosOrigen / tasaCompraUSD;
  if (usd < CONFIG.MIN_USD) return { ok: false, reason: 'UNDER_MIN', usd };
  if (usd > CONFIG.MAX_USD) return { ok: false, reason: 'OVER_MAX', usd };

  return { ok: true, usd, aPesosOrigen };
}
