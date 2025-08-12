export const userLocale = navigator.language || "es-ES";
export function normalizarTimestamp(ts){ if(!ts) return null; const n=Number(ts); if(Number.isFinite(n)) return n<1e12?n*1000:n; const p=Date.parse(ts); return Number.isFinite(p)?p:null; }
export function formatearFecha(ts){ if(!ts) return "hoy"; const d=new Date(ts); if(isNaN(d)) return "hoy"; return d.toLocaleDateString(userLocale,{day:"2-digit",month:"long",year:"numeric"}); }
export function formatearTasa(v){ const n=Number(v); if(!Number.isFinite(n)) return "-"; if(n>=1) return n.toFixed(1); if(n>=0.01) return n.toFixed(3); if(n>=0.00099) return n.toFixed(5); return n.toFixed(6); }
export function redondearPorMoneda(valor,moneda){ let u=1; switch(moneda){case"ARS":case"COP":case"CLP":u=100;break;case"VES":case"MXN":case"PEN":case"BRL":u=1;break;} if(valor<u) return Math.round(valor); const r=valor%u; return r>=u/2?valor+(u-r):valor-r; }
