// src/ui/sharing.js
import { formatearTasa } from "../core/utils.js";
import { NUMERO_WHATSAPP } from "../core/config.js";
import { mostrarToast } from "./toasts.js";

// Carga html2canvas on-demand
function ensureHtml2Canvas() {
  return new Promise((resolve, reject) => {
    if (window.html2canvas) return resolve(window.html2canvas);
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
    s.async = true;
    s.onload = () => resolve(window.html2canvas);
    s.onerror = () => reject(new Error("No se pudo cargar html2canvas"));
    document.head.appendChild(s);
  });
}

export function initSharing(DOM, getLastCalc) {
  const menu = DOM.btnCompartir?.nextElementSibling; // #menuCompartir

  // Abre/cierra menú
  DOM.btnCompartir?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!menu) return;
    menu.classList.toggle("hidden");
  });
  document.addEventListener("click", (e) => {
    if (!menu) return;
    if (!menu.contains(e.target) && e.target !== DOM.btnCompartir) {
      menu.classList.add("hidden");
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") menu?.classList.add("hidden");
  });

  // Compartir TEXTO (Web Share -> Clipboard -> textarea)
  DOM.opcionTexto?.addEventListener("click", async () => {
    menu?.classList.add("hidden");
    const last = getLastCalc();
    if (!last) { mostrarToast(DOM, "⚠️ Primero realiza un cálculo"); return; }
    const { mode, origen, destino, montoIngresado, montoCalculado, tasa, fecha } = last;
    const tasaFmt = formatearTasa(tasa);
    const inFmt = montoIngresado.toLocaleString("es-ES");
    const calFmt = montoCalculado.toLocaleString("es-ES");
    const texto =
      "📦 Transferencia calculada con ByteTransfer\n\n" +
      (mode === "enviar"
        ? `💰 Monto a enviar: $${inFmt} ${origen.codigo} desde ${origen.nombre}\n` +
          `📥 Monto a recibir: ${destino.codigo} ${calFmt} en ${destino.nombre}`
        : `📥 Monto a recibir: ${destino.codigo} ${inFmt} en ${destino.nombre}\n` +
          `💰 Monto a enviar: $${calFmt} ${origen.codigo} desde ${origen.nombre}`) +
      `\n💱 Tasa del día: ${tasaFmt}\n📅 Fecha: ${fecha}`;

    // 1) Web Share (sin archivos)
    if (navigator.share && !navigator.canShare?.({ files: [] })) {
      try { await navigator.share({ title: "ByteTransfer", text: texto }); return; } catch {}
    }
    // 2) Clipboard API
    try { await navigator.clipboard.writeText(texto); mostrarToast(DOM, "Texto copiado ✅"); return; } catch {}
    // 3) Fallback clásico
    const ta = document.createElement("textarea");
    ta.value = texto; document.body.appendChild(ta);
    ta.select(); ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand("copy"); ta.remove();
    mostrarToast(DOM, ok ? "Texto copiado ✅" : "⚠️ No se pudo copiar");
  });

  // Compartir IMAGEN (Web Share con archivo -> descarga)
  DOM.opcionImagen?.addEventListener("click", async () => {
    menu?.classList.add("hidden");
    const card = DOM.resTextContainer;
    if (!card) { mostrarToast(DOM, "⚠️ No encontré el resultado para capturar"); return; }
    try {
      const h2c = await ensureHtml2Canvas();
      const canvas = await h2c(card, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("No se pudo crear la imagen");
      const file = new File([blob], "byte-transfer-result.png", { type: "image/png" });

      // Web Share con archivo (si el navegador lo soporta)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ title: "ByteTransfer", text: "Resultado del cálculo", files: [file] });
          return;
        } catch {} // cancelado por el usuario
      }
      // Fallback: descargar
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "byte-transfer-result.png";
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      mostrarToast(DOM, "Imagen descargada 📷✅");
    } catch (err) {
      console.error("Compartir imagen falló:", err);
      mostrarToast(DOM, "⚠️ No se pudo generar la imagen. Reintenta.");
    }
  });

  // WhatsApp
  DOM.btnWhats?.addEventListener("click", () => {
    const last = getLastCalc();
    if (!last) { mostrarToast(DOM, "⚠️ Primero realiza un cálculo antes de enviar por WhatsApp"); return; }
    const { mode, origen, destino, montoIngresado, montoCalculado, tasa, fecha } = last;
    const tasaFmt = formatearTasa(tasa);
    const inFmt = montoIngresado.toLocaleString("es-ES");
    const calFmt = montoCalculado.toLocaleString("es-ES");
    const msg =
      `👋 ¡Hola ByteTransfer!\n\n` +
      `Quiero enviar *${mode === "enviar" ? `$${inFmt} ${origen.codigo}` : `$${calFmt} ${origen.codigo}`}* desde *${origen.nombre}* ${origen.emoji} 📤\n` +
      `para que lleguen *${mode === "enviar" ? `${calFmt} ${destino.codigo}` : `${inFmt} ${destino.codigo}`}* a *${destino.nombre}* ${destino.emoji} 📬\n\n` +
      `💱 *Tasa del día:* ${tasaFmt}\n📅 *Fecha:* ${fecha}\n\n` +
      `¿Podrían ayudarme con esta transferencia? 🙏✨\n` +
      `Ya les paso el comprobante 📸✅`;
    const url = `https://api.whatsapp.com/send?phone=${NUMERO_WHATSAPP}&text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  });
}
