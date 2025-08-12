const listeners = new Map();
const state = { origen:null, destino:null, mode:null, tasa:null, tasaCompraUSD:null, tasaDesactualizada:true, lastCalc:null };
export function getState(){ return { ...state }; }
export function setState(patch){ Object.assign(state,patch); emit("state:changed",getState()); }
export function on(event,fn){ if(!listeners.has(event)) listeners.set(event,new Set()); listeners.get(event).add(fn); return ()=>listeners.get(event)?.delete(fn); }
function emit(ev,p){ listeners.get(ev)?.forEach(fn=>fn(p)); }
