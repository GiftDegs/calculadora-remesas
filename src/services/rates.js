import { normalizarTimestamp } from "../core/utils.js";
export async function obtenerTasa(origen,destino){
  const ctrl=new AbortController(); const timer=setTimeout(()=>ctrl.abort(),10000);
  try{
    const res=await fetch("/api/snapshot",{cache:"no-store",signal:ctrl.signal});
    if(!res.ok) throw new Error("HTTP "+res.status);
    const data=await res.json();
    const clave=`${origen}-${destino}`;
    const compra=Number(data?.[origen]?.compra) || null;
    const tasaRaw = data?.cruces?.[clave] ?? null;
    return { tasa: tasaRaw, compra, fecha: normalizarTimestamp(data?.timestamp) };
  }catch(e){ console.error("obtenerTasa error:",e); return { tasa:null, compra:null, fecha:null }; }
  finally{ clearTimeout(timer); }
}
