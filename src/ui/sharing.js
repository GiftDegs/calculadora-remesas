import { formatearTasa } from "../core/utils.js";
import { NUMERO_WHATSAPP } from "../core/config.js";
import { mostrarToast } from "./toasts.js";
export function initSharing(DOM,getLastCalc){
  DOM.btnWhats.onclick = ()=>{
    const last=getLastCalc(); if(!last){ mostrarToast(DOM,"⚠️ Primero realiza un cálculo antes de enviar por WhatsApp"); return; }
    const { mode, origen, destino, montoIngresado, montoCalculado, tasa, fecha } = last;
    const t=formatearTasa(tasa);
    const inFmt=montoIngresado.toLocaleString("es-ES"); const calFmt=montoCalculado.toLocaleString("es-ES");
    const origenFmt = mode==="enviar"? `$${inFmt} ${origen.codigo}` : `$${calFmt} ${origen.codigo}`;
    const destinoFmt= mode==="enviar"? `${calFmt} ${destino.codigo}` : `${inFmt} ${destino.codigo}`;
    const msg = `👋 ¡Hola ByteTransfer!\n\nQuiero enviar *${origenFmt}* desde *${origen.nombre}* ${origen.emoji} 📤\npara que lleguen *${destinoFmt}* a *${destino.nombre}* ${destino.emoji} 📬\n\n💱 *Tasa del día:* ${t}\n📅 *Fecha:* ${fecha}\n\n¿Podrían ayudarme con esta transferencia? 🙏✨\nYa les paso el comprobante 📸✅`;
    window.open(`https://api.whatsapp.com/send?phone=${NUMERO_WHATSAPP}&text=${encodeURIComponent(msg)}`,"_blank");
  };
  DOM.btnCompartir?.addEventListener("click",e=>{ e.stopPropagation(); DOM.btnCompartir.nextElementSibling?.classList.remove("hidden"); });
  DOM.opcionTexto?.addEventListener("click", async ()=>{
    DOM.btnCompartir.nextElementSibling?.classList.add("hidden");
    const last=getLastCalc(); if(!last){ mostrarToast(DOM,"⚠️ Primero realiza un cálculo antes de compartir"); return; }
    const { mode, origen, destino, montoIngresado, montoCalculado, tasa, fecha } = last;
    const t=formatearTasa(tasa);
    const inFmt=montoIngresado.toLocaleString("es-ES"); const calFmt=montoCalculado.toLocaleString("es-ES");
    const texto = "📦 Transferencia calculada con ByteTransfer\n\n" +
      (mode==="enviar"
        ? `💰 Monto a enviar: $${inFmt} ${origen.codigo} desde ${origen.nombre}\n📥 Monto a recibir: ${destino.codigo} ${calFmt} en ${destino.nombre}`
        : `📥 Monto a recibir: ${destino.codigo} ${inFmt} en ${destino.nombre}\n💰 Monto a enviar: $${calFmt} ${origen.codigo} desde ${origen.nombre}`) +
      `\n💱 Tasa del día: ${t}\n📅 Fecha: ${fecha}`;
    try{ await navigator.clipboard.writeText(texto); mostrarToast(DOM,"Texto copiado ✅"); }catch{ mostrarToast(DOM,"⚠️ Error al copiar"); }
  });
  document.addEventListener("click", e=>{
    const menu = DOM.btnCompartir?.nextElementSibling; if(!menu) return;
    if(!menu.contains(e.target) && e.target!==DOM.btnCompartir){ menu.classList.add("hidden"); }
  });
}
