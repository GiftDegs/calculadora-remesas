import { formatearTasa } from '../core/utils.js';
import { NUMERO_WHATSAPP } from '../core/config.js';
import { mostrarToast } from './toasts.js';

export function initSharing(DOM, getLastCalc) {
  DOM.btnWhats.onclick = () => {
    const lastCalc = getLastCalc();
    if (!lastCalc) {
      mostrarToast(DOM, '⚠️ Primero realiza un cálculo antes de enviar por WhatsApp');
      return;
    }
    const { mode, origen, destino, montoIngresado, montoCalculado, tasa, fecha } = lastCalc;
    const tasaFmt = formatearTasa(tasa);
    const ingresadoFmt = montoIngresado.toLocaleString('es-ES');
    const calculadoFmt = montoCalculado.toLocaleString('es-ES');
    const montoOrigenFmt = mode === 'enviar'
      ? `$${ingresadoFmt} ${origen.codigo}`
      : `$${calculadoFmt} ${origen.codigo}`;
    const montoDestinoFmt = mode === 'enviar'
      ? `${calculadoFmt} ${destino.codigo}`
      : `${ingresadoFmt} ${destino.codigo}`;
    const mensajeCliente =
      `👋 ¡Hola ByteTransfer!\n\n` +
      `Quiero enviar *${montoOrigenFmt}* desde *${origen.nombre}* ${origen.emoji} 📤\n` +
      `para que lleguen *${montoDestinoFmt}* a *${destino.nombre}* ${destino.emoji} 📬\n\n` +
      `💱 *Tasa del día:* ${tasaFmt}\n📅 *Fecha:* ${fecha}\n\n` +
      `¿Podrían ayudarme con esta transferencia? 🙏✨\n` +
      `Ya les paso el comprobante 📸✅`;

    const url = `https://api.whatsapp.com/send?phone=${NUMERO_WHATSAPP}&text=${encodeURIComponent(mensajeCliente)}`;
    window.open(url, '_blank');
  };

  DOM.opcionTexto.onclick = async () => {
    DOM.btnCompartir.nextElementSibling.classList.add('hidden');
    const lastCalc = getLastCalc();
    if (!lastCalc) {
      mostrarToast(DOM, '⚠️ Primero realiza un cálculo antes de compartir');
      return;
    }
    const { mode, origen, destino, montoIngresado, montoCalculado, tasa, fecha } = lastCalc;
    const tasaFmt = formatearTasa(tasa);
    const ingresadoFmt = montoIngresado.toLocaleString('es-ES');
    const calculadoFmt = montoCalculado.toLocaleString('es-ES');
    const mensajePro =
      `📦 Transferencia calculada con ByteTransfer\n\n` +
      (mode === 'enviar'
        ? `💰 Monto a enviar: $${ingresadoFmt} ${origen.codigo} desde ${origen.nombre}\n` +
          `📥 Monto a recibir: ${destino.codigo} ${calculadoFmt} en ${destino.nombre}`
        : `📥 Monto a recibir: ${destino.codigo} ${ingresadoFmt} en ${destino.nombre}\n` +
          `💰 Monto a enviar: $${calculadoFmt} ${origen.codigo} desde ${origen.nombre}`) +
      `\n💱 Tasa del día: ${tasaFmt}\n📅 Fecha: ${fecha}`;
    try {
      await navigator.clipboard.writeText(mensajePro);
      mostrarToast(DOM, 'Texto copiado ✅');
    } catch {
      mostrarToast(DOM, '⚠️ Error al copiar');
    }
  };
}
