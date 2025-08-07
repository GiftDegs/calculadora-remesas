// Detectar configuración regional
const userLocale = navigator.language || 'es-ES';

// Config USD y número de WhatsApp
const CONFIG = { MIN_USD: 5, MAX_USD: 1000 };
const NUMERO_WHATSAPP = '5491157261053';

// Estados globales
let aceptoAdvertenciaPartes = false;
let origenSeleccionado = null;
let destinoSeleccionado = null;
let mode = null;
let tasa = null;
let tasaCompraUSD = null;
let estadoActual = 'origen';

// Elementos DOM
const btnVolverGlobal = document.getElementById('btnVolverGlobal');
const mainHeader = document.getElementById('mainHeader');
const subtituloHeader = document.getElementById('subtituloHeader');
const tasaValue = document.getElementById('tasaValue');
const tasaFechaEl = document.getElementById('tasaFecha');
const tasaConfirm = document.getElementById('tasaConfirmacion');
const step1Origen = document.getElementById('step1Origen');
const origenBtns = document.getElementById('origenBtns');
const step2Destino = document.getElementById('step2Destino');
const destinoBtns = document.getElementById('destinoBtns');
const tasaWrap = document.getElementById('tasaWrap');
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const resultado = document.getElementById('resultado');
const btnEnviar = document.getElementById('btnEnviar');
const btnLlegar = document.getElementById('btnLlegar');
const preguntaMonto = document.getElementById('preguntaMonto');
const inputMonto = document.getElementById('inputMonto');
const errorMonto = document.getElementById('errorMonto');
const btnCalcular = document.getElementById('btnCalcular');
const btnRecalcular = document.getElementById('btnRecalcular');
const loader = document.getElementById('calculando');
const resText = document.getElementById('resText');
const soundSuccess = document.getElementById('soundSuccess');
const btnWhats = document.getElementById('btnWhats');
const btnCompartir = document.getElementById('btnCompartir');
const resTextContainer = document.getElementById('resTextContainer');
const opcionTexto = document.getElementById('opcionTexto');
const opcionImagen = document.getElementById('opcionImagen');
const toastMensaje = document.getElementById('toastMensaje');

function actualizarHeader(texto = '') {
  subtituloHeader.textContent = texto;
  mainHeader.classList.remove('hidden');
}

// Países y monedas
const paisesDisponibles = [
  { codigo: 'ARS', nombre: 'Argentina', emoji: '🇦🇷', moneda: 'pesos argentinos' },
  { codigo: 'COP', nombre: 'Colombia', emoji: '🇨🇴', moneda: 'pesos colombianos' },
  { codigo: 'PEN', nombre: 'Perú', emoji: '🇵🇪', moneda: 'soles' },
  { codigo: 'CLP', nombre: 'Chile', emoji: '🇨🇱', moneda: 'pesos chilenos' },
  { codigo: 'MXN', nombre: 'México', emoji: '🇲🇽', moneda: 'pesos mexicanos' },
  { codigo: 'BRL', nombre: 'Brasil', emoji: '🇧🇷', moneda: 'reales' },
  { codigo: 'VES', nombre: 'Venezuela', emoji: '🇻🇪', moneda: 'bolívares' }
];

// --- Utilidades ---
function calcularCruce(origen, destino, modo, monto, tasa) {
  const esColAVen = origen === 'COP' && destino === 'VES';
  if (modo === 'enviar') {
    return esColAVen ? monto / tasa : monto * tasa;
  } else {
    return esColAVen ? monto * tasa : monto / tasa;
  }
}

function formatearFecha(timestamp) {
  if (!timestamp) return 'hoy';
  const d = new Date(timestamp);
  if (isNaN(d)) return 'hoy';
  return d.toLocaleDateString(userLocale, { day:'2-digit', month:'long', year:'numeric' });
}

function redondearPorMoneda(valor, moneda) {
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

function formatearTasa(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  if (n >= 1) return n.toFixed(1);
  if (n >= 0.01) return n.toFixed(3);
  if (n >= 0.00099) return n.toFixed(5);
  return n.toFixed(6);
}

// --- Carga de tasas desde backend ---
async function obtenerTasa(origen, destino) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch('/api/snapshot', { cache: 'no-store', signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const clave = `${origen}-${destino}`;
    const tasaCrudo = data?.cruces?.[clave] ?? null;

    const compra = Number(data?.[origen]?.compra);
    if (Number.isFinite(compra)) {
      tasaCompraUSD = compra; // global
    } else {
      console.warn(`No hay 'compra' USD para ${origen} en snapshot`);
    }

    return { tasa: tasaCrudo, fecha: data?.timestamp ?? null };
  } catch (err) {
    console.error('Error al obtener tasa:', err);
    return { tasa: null, fecha: null };
  } finally {
    clearTimeout(timer);
  }
}

// --- UI Flow ---
function ocultarTodo() {
  step1Origen.classList.add('hidden');
  step2Destino.classList.add('hidden');
  step1.classList.add('hidden');
  step2.classList.add('hidden');
  tasaWrap.classList.add('hidden');
  resultado.classList.add('hidden');
}

function mostrarPaso1() {
  estadoActual = 'origen';
  ocultarTodo();
  step1Origen.classList.remove('hidden');
  actualizarHeader('Selecciona el país de origen');
  btnVolverGlobal.classList.add('hidden');
  step1Origen.classList.add('fade-slide-in');

  origenBtns.innerHTML = '';
  paisesDisponibles.forEach(pais => {
    const btn = document.createElement('button');
    btn.textContent = `${pais.emoji} ${pais.nombre}`;
    btn.className = 'ripple-button bg-white dark:bg-gray-100 border border-[#0066FF] text-[#0066FF] font-semibold px-6 py-3 rounded-xl shadow transition hover:scale-105';
    btn.onclick = () => { origenSeleccionado = pais.codigo; mostrarPaso2(); };
    origenBtns.appendChild(btn);
  });
}

function mostrarPaso2() {
  estadoActual = 'destino';
  ocultarTodo();
  step2Destino.classList.remove('hidden');
  actualizarHeader('Selecciona el país destino');
  btnVolverGlobal.classList.remove('hidden');
  step2Destino.classList.add('fade-slide-in');

  destinoBtns.innerHTML = '';
  paisesDisponibles
    .filter(p => p.codigo !== origenSeleccionado)
    .forEach(pais => {
      const btn = document.createElement('button');
      btn.textContent = `${pais.emoji} ${pais.nombre}`;
      btn.className = 'ripple-button bg-white dark:bg-gray-100 border border-[#0066FF] text-[#0066FF] font-semibold px-6 py-3 rounded-xl shadow transition hover:scale-105';
      btn.onclick = () => { destinoSeleccionado = pais.codigo; step2Destino.classList.add('hidden'); mostrarPaso3(); };
      destinoBtns.appendChild(btn);
    });
}

async function mostrarPaso3() {
  estadoActual = 'modo';
  ocultarTodo();
  step1.classList.remove('hidden');
  btnVolverGlobal.classList.remove('hidden');
  mainHeader.classList.remove('hidden');
  tasaWrap.classList.remove('hidden');
  actualizarHeader('Selecciona el tipo de operación');

  const paisOrigen = paisesDisponibles.find(p => p.codigo === origenSeleccionado);
  const paisDestino = paisesDisponibles.find(p => p.codigo === destinoSeleccionado);
  const subtitulo = document.querySelector('header p');

  btnEnviar.textContent = `¿Cuántos ${paisOrigen.moneda} quieres enviar?`;
  btnLlegar.textContent = `¿Cuántos ${paisDestino.moneda} quieres que lleguen?`;

  if (paisOrigen && paisDestino && subtitulo) {
    subtitulo.textContent = `De ${paisOrigen.nombre} (${paisOrigen.moneda}) a ${paisDestino.nombre} (${paisDestino.moneda})`;
  }

  const { tasa: tasaCruda, fecha } = await obtenerTasa(origenSeleccionado, destinoSeleccionado);

  if (tasaCruda) {
    tasa = parseFloat(tasaCruda);
    tasaValue.textContent = formatearTasa(tasa);
    tasaFechaEl.textContent = formatearFecha(fecha);

    tasaConfirm.classList.remove('hidden');
    setTimeout(() => tasaConfirm.classList.add('hidden'), 3000);
    tasaValue.classList.add('animate-pulse');
    setTimeout(() => tasaValue.classList.remove('animate-pulse'), 1000);
  } else {
    tasaValue.textContent = '⚠️ No disponible';
    mostrarToast('No hay tasa disponible para ese cruce');
  }
}

function cambiarPaso(tipo) {
  mode = tipo;
  const paisOrigen = paisesDisponibles.find(p => p.codigo === origenSeleccionado);
  const paisDestino = paisesDisponibles.find(p => p.codigo === destinoSeleccionado);

  preguntaMonto.textContent = tipo === 'enviar'
    ? `¿Cuántos ${paisOrigen.moneda} vas a enviar?`
    : `¿Cuántos ${paisDestino.moneda} quieres que lleguen?`;

  preguntaMonto.classList.remove('opacity-0','translate-y-4');
  preguntaMonto.classList.add('opacity-100','translate-y-0');
  step1.classList.add('hidden');
  step2.classList.remove('hidden');
  setTimeout(() => inputMonto.focus(), 300);
}

btnEnviar.onclick = () => cambiarPaso('enviar');
btnLlegar.onclick = () => cambiarPaso('llegar');

// --- Normalización input ---
inputMonto.addEventListener('input', () => {
  let val = inputMonto.value.replace(/[^0-9.]/g, '');
  const parts = val.split('.');
  if (parts.length > 2) val = parts[0] + '.' + parts[1];
  if (parts[1]?.length > 2) val = parts[0] + '.' + parts[1].slice(0,2);
  inputMonto.value = val;
});

let scrollAntesDeTeclado = 0;
inputMonto.addEventListener('focus', () => {
  scrollAntesDeTeclado = window.scrollY;
  setTimeout(() => inputMonto.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
});
inputMonto.addEventListener('blur', () => {
  setTimeout(() => window.scrollTo({ top: scrollAntesDeTeclado, behavior: 'smooth' }), 150);
});
inputMonto.addEventListener('keydown', e => { if (e.key === 'Enter') btnCalcular.click(); });

// --- Calcular ---
btnCalcular.onclick = () => {
  const raw = inputMonto.value.trim();
  const monto = parseFloat(raw);
  const tasaF = parseFloat(tasa);

  estadoActual = 'resultado';
  btnVolverGlobal.classList.remove('hidden');

  if (isNaN(monto)) {
    errorMonto.textContent = '⚠️ Ingresa un número válido';
    errorMonto.classList.remove('hidden');
    return;
  }
  if (isNaN(tasaF) || tasaF <= 0) {
    errorMonto.textContent = '⚠️ La tasa aún no se ha cargado. Intenta actualizarla manualmente.';
    errorMonto.classList.remove('hidden');
    return;
  }
  if (!tasaCompraUSD) {
    errorMonto.textContent = '⚠️ No se pudo obtener la tasa de compra en USD.';
    errorMonto.classList.remove('hidden');
    return;
  }

  const montoEnPesos = mode === 'enviar' ? monto : calcularCruce(origenSeleccionado, destinoSeleccionado, mode, monto, tasaF);
  const montoUSD = montoEnPesos / tasaCompraUSD;

  if (montoUSD < CONFIG.MIN_USD) {
    errorMonto.textContent = `⚠️ El monto mínimo permitido es equivalente a ${CONFIG.MIN_USD} USD`;
    errorMonto.classList.remove('hidden');
    return;
  }
  if (montoUSD > CONFIG.MAX_USD) {
    errorMonto.textContent = `⚠️ El monto máximo permitido es equivalente a ${CONFIG.MAX_USD} USD`;
    errorMonto.classList.remove('hidden');
    return;
  }

  if (montoUSD > 400 && !aceptoAdvertenciaPartes) {
    const partes = Math.ceil(montoUSD / 200);
    errorMonto.innerHTML = `⚠️ Por montos superiores a 400 USD, la transferencia debe realizarse en ${partes} partes.<br>Debes confirmar que leíste y aceptas esta condición.`;
    if (!document.getElementById('btnAceptarRegla')) {
      const btn = document.createElement('button');
      btn.id = 'btnAceptarRegla';
      btn.textContent = 'Leí y acepto';
      btn.className = 'mt-2 px-4 py-2 bg-blue-600 text-white rounded';
      btn.onclick = () => { aceptoAdvertenciaPartes = true; errorMonto.classList.add('hidden'); btn.remove(); };
      errorMonto.appendChild(btn);
    }
    errorMonto.classList.remove('hidden');
    return;
  }

  errorMonto.classList.add('hidden');

  const calc = Math.round(calcularCruce(origenSeleccionado, destinoSeleccionado, mode, monto, tasaF));
  const paisOrigen = paisesDisponibles.find(p => p.codigo === origenSeleccionado);
  const paisDestino = paisesDisponibles.find(p => p.codigo === destinoSeleccionado);

  const calcRedondeado = mode === 'llegar' ? redondearPorMoneda(calc, paisOrigen.codigo) : calc;

  const fecha = tasaFechaEl.textContent;
  const montoFmt = new Intl.NumberFormat(userLocale, { maximumFractionDigits: 2 }).format(monto);
  const calcFmt = new Intl.NumberFormat(userLocale, { maximumFractionDigits: 0 }).format(calcRedondeado);
  const tasaFmt = formatearTasa(tasa);

  const mensaje = mode === 'enviar'
    ? `<div class="text-sm italic text-gray-500 dark:text-gray-400">Enviando desde ${paisOrigen.nombre}</div>
       <div class="text-3xl font-semibold text-blue-800 dark:text-blue-400">$${montoFmt} ${paisOrigen.codigo}</div>
       <div class="text-base text-gray-600 dark:text-gray-300 mt-1">recibirás</div>
       <div class="text-4xl font-extrabold text-blue-900 dark:text-blue-200">${paisDestino.codigo} ${calcFmt}</div>
       <div class="text-sm italic text-gray-500 dark:text-gray-400 mt-4">Calculado con la tasa del día ${fecha} — <span class="font-semibold text-blue-800 dark:text-blue-400">${tasaFmt}</span></div>`
    : `<div class="text-sm italic text-gray-500 dark:text-gray-400">Para recibir en ${paisDestino.nombre}</div>
       <div class="text-3xl font-semibold text-blue-800 dark:text-blue-400">${paisDestino.codigo} ${montoFmt}</div>
       <div class="text-base text-gray-600 dark:text-gray-300 mt-1">debes enviar</div>
       <div class="text-4xl font-extrabold text-blue-900 dark:text-blue-200">$${calcFmt} ${paisOrigen.codigo}</div>
       <div class="text-sm italic text-gray-500 dark:text-gray-400 mt-4">Calculado con la tasa del día ${fecha} — <span class="font-semibold text-blue-800 dark:text-blue-400">${tasaFmt}</span></div>`;

  resText.innerHTML = mensaje;
  if (!soundSuccess.muted) soundSuccess.play();

  aceptoAdvertenciaPartes = false;

  step2.classList.add('hidden');
  tasaWrap.classList.add('transition', 'duration-500', 'ease-out', 'opacity-0', 'scale-95');
  setTimeout(() => tasaWrap.classList.add('hidden'), 500);

  loader.classList.remove('hidden');
  setTimeout(() => {
    loader.classList.add('hidden');
    resultado.classList.remove('hidden');
    resultado.classList.add('fade-scale-in');
    resText.classList.add('text-4xl');
  }, 1500);
};

btnRecalcular.onclick = () => {
  inputMonto.value = '';
  resText.classList.remove('text-4xl');
  resultado.classList.add('hidden');
  resultado.classList.remove('fade-scale-in');
  step1.classList.remove('hidden');
  tasaWrap.classList.remove('hidden');
  setTimeout(() => tasaWrap.classList.remove('opacity-0', 'scale-95'), 50);
};

// --- WhatsApp ---
btnWhats.onclick = () => {
  const fecha = tasaFechaEl.textContent;
  const tasaFmt = formatearTasa(tasa);
  const paisOrigen = paisesDisponibles.find(p => p.codigo === origenSeleccionado);
  const paisDestino = paisesDisponibles.find(p => p.codigo === destinoSeleccionado);

  const rawValue = parseFloat(inputMonto.value.trim());
  const montoIngresado = isNaN(rawValue) ? 0 : rawValue;

  if (!montoIngresado || !tasa) {
    mostrarToast('⚠️ Primero realiza un cálculo antes de enviar por WhatsApp');
    return;
  }

  let montoCalculado = Math.round(calcularCruce(origenSeleccionado, destinoSeleccionado, mode, montoIngresado, tasa));
  if (mode === 'llegar') {
    montoCalculado = redondearPorMoneda(montoCalculado, paisOrigen.codigo);
  }

  const ingresadoFmt = montoIngresado.toLocaleString('es-ES');
  const calculadoFmt = montoCalculado.toLocaleString('es-ES');

  const montoOrigenFmt = mode === 'enviar' ? `$${ingresadoFmt} ${paisOrigen.codigo}` : `$${calculadoFmt} ${paisOrigen.codigo}`;
  const montoDestinoFmt = mode === 'enviar' ? `${calculadoFmt} ${paisDestino.codigo}` : `${ingresadoFmt} ${paisDestino.codigo}`;

  const mensajeCliente =
    `👋 ¡Hola ByteTransfer!\n\n` +
    `Quiero enviar *${montoOrigenFmt}* desde *${paisOrigen.nombre}* ${paisOrigen.emoji} 📤\n` +
    `para que lleguen *${montoDestinoFmt}* a *${paisDestino.nombre}* ${paisDestino.emoji} 📬\n\n` +
    `💱 *Tasa del día:* ${tasaFmt}\n📅 *Fecha:* ${fecha}\n\n` +
    `¿Podrían ayudarme con esta transferencia? 🙏✨\n` +
    `Ya les paso el comprobante 📸✅`;

  const whatsappBtn = btnWhats;
  whatsappBtn.disabled = true;
  whatsappBtn.innerHTML = `
    <svg class="animate-spin h-5 w-5 mr-2 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
    </svg>
    Generando mensaje...`;

  setTimeout(() => {
    const url = `https://api.whatsapp.com/send?phone=${NUMERO_WHATSAPP}&text=${encodeURIComponent(mensajeCliente)}`;
    window.open(url, '_blank');
    whatsappBtn.disabled = false;
    whatsappBtn.innerHTML = 'Ir a WhatsApp';
  }, 600);
};

// --- Compartir ---
btnCompartir.onclick = (e) => {
  e.stopPropagation();
  btnCompartir.nextElementSibling.classList.remove('hidden');
};

opcionTexto.onclick = async () => {
  btnCompartir.nextElementSibling.classList.add('hidden');

  const fecha = tasaFechaEl.textContent;
  const tasaF = parseFloat(tasa);
  const raw = parseFloat(inputMonto.value.trim());
  const montoIngresado = isNaN(raw) ? 0 : raw;

  const paisOrigen = paisesDisponibles.find(p => p.codigo === origenSeleccionado);
  const paisDestino = paisesDisponibles.find(p => p.codigo === destinoSeleccionado);

  let montoCalculado = Math.round(calcularCruce(origenSeleccionado, destinoSeleccionado, mode, montoIngresado, tasaF));
  if (mode === 'llegar') {
    // redondeo por MONEDA DE ORIGEN para mantener consistencia
    montoCalculado = redondearPorMoneda(montoCalculado, paisOrigen.codigo);
  }

  const ingresadoFmt = montoIngresado.toLocaleString('es-ES');
  const calculadoFmt = montoCalculado.toLocaleString('es-ES');
  const tasaFmt = formatearTasa(tasaF);

  const mensajePro =
    `📦 Transferencia calculada con ByteTransfer\n\n` +
    (mode === 'enviar'
      ? `💰 Monto a enviar: $${ingresadoFmt} ${paisOrigen.codigo} desde ${paisOrigen.nombre}\n` +
        `📥 Monto a recibir: ${paisDestino.codigo} ${calculadoFmt} en ${paisDestino.nombre}`
      : `📥 Monto a recibir: ${paisDestino.codigo} ${ingresadoFmt} en ${paisDestino.nombre}\n` +
        `💰 Monto a enviar: $${calculadoFmt} ${paisOrigen.codigo} desde ${paisOrigen.nombre}`) +
    `\n💱 Tasa del día: ${tasaFmt}\n📅 Fecha: ${fecha}`;

  try {
    await navigator.clipboard.writeText(mensajePro);
    mostrarToast('Texto copiado ✅');
  } catch (err) {
    mostrarToast('⚠️ Error al copiar');
    console.error(err);
  }
};

opcionImagen.onclick = async () => {
  btnCompartir.nextElementSibling.classList.add('hidden');
  const canvas = await html2canvas(resTextContainer, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  const file = new File([blob], 'byte-transfer-result.png', { type: 'image/png' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ title: 'ByteTransfer', text: 'Resultado de cambio enviado desde la app ByteTransfer', files: [file] });
    } catch (err) {
      console.warn('Share cancelado o falló:', err);
    }
  } else {
    const link = document.createElement('a');
    link.download = 'byte-transfer-result.png';
    link.href = canvas.toDataURL();
    link.click();
  }
};

document.addEventListener('click', e => {
  const menu = btnCompartir.nextElementSibling;
  if (!menu.contains(e.target) && e.target !== btnCompartir) {
    menu.classList.add('hidden');
  }
});

// Ripple por delegación (funciona con botones creados dinámicamente)
document.addEventListener('click', e => {
  const btn = e.target.closest('.ripple-button');
  if (!btn) return;
  const ripple = document.createElement('span');
  const d = Math.max(btn.clientWidth, btn.clientHeight);
  const r = d / 2;
  ripple.style.width = ripple.style.height = `${d}px`;
  const rect = btn.getBoundingClientRect();
  ripple.style.left = `${e.clientX - rect.left - r}px`;
  ripple.style.top = `${e.clientY - rect.top - r}px`;
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
});

// Toast
function mostrarToast(txt) {
  toastMensaje.textContent = txt;
  toastMensaje.classList.remove('hidden');
  toastMensaje.style.opacity = '1';
  toastMensaje.style.transform = 'scale(1)';
  setTimeout(() => {
    toastMensaje.style.opacity = '0';
    toastMensaje.style.transform = 'scale(0.95)';
    setTimeout(() => {
      toastMensaje.classList.add('hidden');
      toastMensaje.textContent = '';
    }, 300);
  }, 4500);
}

// Onload
window.onload = () => {
  mainHeader.classList.add('hidden');
  document.getElementById('tasaWrap').classList.add('hidden');
  step1.classList.add('hidden');
  step2.classList.add('hidden');
  resultado.classList.add('hidden');
  step2Destino.classList.add('hidden');
  step1Origen.classList.remove('hidden');
  mostrarPaso1();
};
