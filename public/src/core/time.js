// public/src/core/time.js
const TZ = 'America/Argentina/Buenos_Aires';

// Horarios base (hora de Argentina)
const OPENING = {
  0: { start: '11:00', end: '17:00' }, // Domingo
  1: { start: '11:00', end: '23:00' },
  2: { start: '11:00', end: '23:00' },
  3: { start: '11:00', end: '23:00' },
  4: { start: '11:00', end: '23:00' },
  5: { start: '11:00', end: '23:00' },
  6: { start: '11:00', end: '23:00' }  // Sábado
};

// Mínimo para considerar “tasa del día” (hora AR)
const UPDATE_READY_HM = '10:30';

const DOW_IDX = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };

function partsInBA(d = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23'
  });
  const map = {};
  for (const p of fmt.formatToParts(d)) map[p.type] = p.value;
  const w = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(d);
  return { y:+map.year, m:+map.month, d:+map.day, h:+map.hour, min:+map.minute, dow: DOW_IDX[w] };
}

function hmToMin(hm){ const [h,m] = hm.split(':').map(Number); return h*60 + m; }

// === Estado operativo (basado en hora de Argentina) ===
export function isOpenNowBA(){
  const n = partsInBA(); const sch = OPENING[n.dow]; if (!sch) return false;
  const mins = n.h*60 + n.min;
  return mins >= hmToMin(sch.start) && mins < hmToMin(sch.end);
}

export function isRateFreshTodayBA(snapshotTs){
  if (!snapshotTs) return false;
  const snap = partsInBA(new Date(snapshotTs));
  const now  = partsInBA();
  if (snap.y!==now.y || snap.m!==now.m || snap.d!==now.d) return false;
  return (snap.h*60 + snap.min) >= hmToMin(UPDATE_READY_HM);
}

export function evaluateOps(snapshotTs, manual){
  const fresh = isRateFreshTodayBA(snapshotTs);
  let open = isOpenNowBA();
  if (typeof manual?.open === 'boolean') open = manual.open;

  const allowWhats = open && fresh;
  const reasons = [];
  if (!open)  reasons.push('Estamos cerrados ahora');
  if (!fresh) reasons.push('Tasa desactualizada');

  return { open, fresh, allowWhats, message: (manual?.message || reasons.join(' • ')) || '' };
}

// === Presentación “bonita” en HORA LOCAL DEL USUARIO ===
// Convierte el horario de HOY (definido en AR) al huso local del visitante.
export function openingTextTodayLocal(locale = navigator.language || 'es-ES') {
  const n = partsInBA();
  const sch = OPENING[n.dow];
  if (!sch) return 'Hoy: cerrado';

  // Argentina es UTC-3 (sin DST). AR local +3h => UTC.
  const mkUtc = (hm) => {
    const [h,m] = hm.split(':').map(Number);
    return new Date(Date.UTC(n.y, n.m-1, n.d, h + 3, m));
  };

  const startUTC = mkUtc(sch.start);
  const endUTC   = mkUtc(sch.end);

  const fmt = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });
  return `Horario de: ${fmt.format(startUTC)}–${fmt.format(endUTC)}`;
}
