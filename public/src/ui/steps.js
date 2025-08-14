import { DOM } from "./dom.js";
import { paisesDisponibles, CONFIG } from "../core/config.js";
import { formatearTasa, formatearFecha, redondearPorMoneda, userLocale } from "../core/utils.js";
import { calcularCruce } from "../core/fx.js";
import { obtenerTasa } from "../services/rates.js";
import { obtenerStatus } from "../services/status.js";
import { mostrarToast } from "./toasts.js";
import { showBanner, hideBanner, mostrarConfirmacionVerdeAutoOcultar } from "./banners.js";
import { evaluateOps, openingTextTodayLocal } from "../core/time.js";

let origenSeleccionado = null;
let destinoSeleccionado = null;
let mode = null;
let tasa = null;
let tasaCompraUSD = null;
let lastCalc = null;
let modalActivo = false;
let ops = { open: false, fresh: false, allowWhats: false, message: '' };

function mostrarModalMontoGrande(callback) {
  modalActivo = true;
  const modal = document.getElementById("modalMontoGrande");
  const btnCerrar = document.getElementById("btnCerrarModalMonto");

  if (!modal || !btnCerrar) return;

  modal.classList.remove("hidden");
  document.body.classList.add("modal-activo");
  DOM.inputMonto.blur(); // quitar foco

  const cerrarYContinuar = () => {
    modalActivo = false;
    modal.classList.add("hidden");
    document.body.classList.remove("modal-activo");
    btnCerrar.removeEventListener("click", cerrarYContinuar);
    if (typeof callback === "function") callback();
  };

  btnCerrar.addEventListener("click", cerrarYContinuar);
}


// Back: mostrar/ocultar (sin registrar click aquí para evitar duplicados)
(function initBackButton(){
  const btn = document.getElementById('btnVolverGlobal');
  if (!btn) return;

  // Exponer helper global mínimo
  window.showBack = (show = true) => {
    btn.classList.toggle('hidden', !show);
  };
})();

// --- Mostrar pill desde el arranque (Paso 1) ---
(async function initPillEarly(){
  try {
    const manual = await obtenerStatus(); // {open|null, message}
    // No tenemos snapshot aún => fresh=false, pero el pill ya muestra ABIERTO/CERRADO por horario + override
    ops = evaluateOps(null, manual);
  } catch {
    ops = evaluateOps(null, { open: null, message: '' });
  }
  updateHorarioPill();
})();

function updateHorarioPill() {
  // Usamos el espacio del header (entre logo y título)
  const el = document.getElementById('statusHeader');
  if (!el) return;

  const hoy = openingTextTodayLocal(userLocale);
  const abierto = ops.open === true;

  // 1) Clases base NEUTRALES (sin color)
  el.className = 'mt-1 text-base sm:text-lg inline-flex items-center justify-center gap-2 px-3 py-1 rounded-full border shadow-sm';

  // 2) Contenido (punto con ping + texto con pulso)
  el.innerHTML = abierto
    ? `<span class="relative mr-1 inline-flex items-center">
         <span class="absolute inline-flex h-3 w-3 rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
         <span class="relative inline-flex h-3 w-3 rounded-full bg-emerald-600"></span>
       </span>
       <span class="ml-1">ABIERTO</span> · <span class="opacity-90 animate-pulse">${hoy}</span>`
    : `<span class="relative mr-1 inline-flex items-center">
         <span class="absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75 animate-ping"></span>
         <span class="relative inline-flex h-3 w-3 rounded-full bg-red-600"></span>
       </span>
       <span class="ml-1">CERRADO</span> · <span class="opacity-90 animate-pulse">${hoy}</span>`;

  // 3) Colores por estado (semi-transparente + borde del mismo color)
  if (abierto) {
    el.classList.add(
      'bg-emerald-600/30',   // fondo verde translúcido
      'border-emerald-700',  // borde verde oscuro
      'text-emerald-900',    // texto verde oscuro en claro
      'dark:text-white'      // texto blanco en oscuro
    );
  } else {
    el.classList.add(
      'bg-red-600/30',       // fondo rojo translúcido
      'border-red-700',      // borde rojo oscuro
      'text-red-900',        // texto rojo oscuro en claro
      'dark:text-white',     // texto blanco en oscuro
      'animate-pulse'        // leve pulso de la pastilla en cerrado
    );
  }
}

function updateWhatsButton(){
  if (!DOM.btnWhats) return;
  const allow = ops.allowWhats;
  DOM.btnWhats.disabled = !allow;
  DOM.btnWhats.classList.toggle('opacity-50', !allow);
  DOM.btnWhats.classList.toggle('cursor-not-allowed', !allow);
  DOM.btnWhats.textContent = allow ? 'Ir a WhatsApp' : 'Cerrado / Solo referencia';
}

function setModoButtonsEnabled(enabled) {
  [DOM.btnEnviar, DOM.btnLlegar].forEach(b => {
    b.disabled = !enabled;
    b.classList.toggle("opacity-50", !enabled);
    b.classList.toggle("cursor-not-allowed", !enabled);
    b.classList.toggle("hover:scale-105", enabled);
  });
}

function obtenerPais(cod) {
  return paisesDisponibles.find(p => p.codigo === cod);
}

function textosSegunPaises() {
  const o = obtenerPais(origenSeleccionado);
  const d = obtenerPais(destinoSeleccionado);
  if (!o || !d) {
    return {
      btnEnviar: "¿Cuánto dinero quieres enviar?",
      btnLlegar: "¿Cuánto quieres que llegue?",
      preguntaEnviar: "¿Cuánto vas a enviar?",
      preguntaLlegar: "¿Cuánto quieres que llegue?"
    };
  }
  return {
    btnEnviar: `¿Cuántos ${o.moneda} quieres enviar?`,
    btnLlegar: `¿Cuántos ${d.moneda} quieres que lleguen?`,
    preguntaEnviar: `¿Cuántos ${o.moneda} vas a enviar?`,
    preguntaLlegar: `¿Cuántos ${d.moneda} quieres que lleguen?`
  };
}

function actualizarTextosUI() {
  const { btnEnviar: tEnviar, btnLlegar: tLlegar } = textosSegunPaises();
  DOM.btnEnviar.textContent = tEnviar;
  DOM.btnLlegar.textContent = tLlegar;

  const o = obtenerPais(origenSeleccionado);
  const d = obtenerPais(destinoSeleccionado);
  if (o && d) {
    // Texto corto y responsivo
    const isSmall = window.innerWidth < 420; // móviles muy angostos
    const subt = isSmall
      ? `${o.codigo} → ${d.codigo}`
      : `${o.nombre} (${o.codigo}) → ${d.nombre} (${d.codigo})`;
    DOM.subtituloHeader.textContent = subt;

    // Estilo más discreto (tamaño fluido)
    DOM.subtituloHeader.className =
      "transition-colors duration-500 text-[clamp(0.9rem,2.2vw,1rem)] " +
      "text-[#666666] dark:text-gray-300 text-center -mt-1";
  }
}

function setInputStyle({ state, msg = null }) {
  DOM.inputMonto.classList.remove(
    "border-blue-300","border-green-500","border-red-500",
    "focus:ring-blue-300","focus:ring-green-500","focus:ring-red-500"
  );
  if (msg !== null) DOM.ayudaMonto.textContent = msg;
  if (state === "neutral") DOM.inputMonto.classList.add("border-blue-300","focus:ring-blue-300");
  else if (state === "ok") DOM.inputMonto.classList.add("border-green-500","focus:ring-green-500");
  else if (state === "error") DOM.inputMonto.classList.add("border-red-500","focus:ring-red-500");
}

function maxPermitidoEnInput() {
  if (!mode || !tasaCompraUSD) return null;
  const maxPesosOrigen = CONFIG.MAX_USD * tasaCompraUSD;
  if (mode === "enviar") return maxPesosOrigen;
  if (!tasa || !Number.isFinite(parseFloat(tasa))) return null;
  return calcularCruce(origenSeleccionado, destinoSeleccionado, "enviar", maxPesosOrigen, parseFloat(tasa));
}

function rangoPermitidoEnInput() {
  if (!mode || !tasaCompraUSD) return null;
  const minPesosOrigen = CONFIG.MIN_USD * tasaCompraUSD;
  const maxPesosOrigen = CONFIG.MAX_USD * tasaCompraUSD;
  const convertir = (m) => mode === "enviar"
    ? m
    : calcularCruce(origenSeleccionado, destinoSeleccionado, "enviar", m, parseFloat(tasa));
  const minInput = convertir(minPesosOrigen);
  const maxInput = convertir(maxPesosOrigen);
  if (!Number.isFinite(minInput) || !Number.isFinite(maxInput)) return null;
  return { min: minInput, max: maxInput };
}

function updateAyudaRangos() {
  const o = obtenerPais(origenSeleccionado);
  const d = obtenerPais(destinoSeleccionado);

  // Estilo compacto del bloque (1 sola vez)
  DOM.ayudaMonto.className =
    "text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center leading-snug";

  // Sin modo o sin datos: limpia y sale
  if (!mode) { DOM.ayudaMonto.innerHTML = ""; return; }

  // Mensajes de “cargando” cuando falten tasas
  if (mode === "enviar" && !tasaCompraUSD) {
    DOM.ayudaMonto.innerHTML = `<span class="block">Calculando límites…</span>`;
    return;
  }
  if (mode === "llegar" && (!tasaCompraUSD || !tasa)) {
    DOM.ayudaMonto.innerHTML = `<span class="block">Esperando tasa para calcular límites…</span>`;
    return;
  }

  // Rango permitido calculado
  const rango = rangoPermitidoEnInput();
  if (!rango) { DOM.ayudaMonto.innerHTML = ""; return; }

  // Formateadores
  const nf2 = new Intl.NumberFormat(userLocale, { maximumFractionDigits: 2 });
  const minFmt = nf2.format(Math.max(0, rango.min));
  const maxFmt = nf2.format(Math.max(rango.min, rango.max));
  const codigoInput = mode === "llegar" ? (d?.codigo ?? "") : (o?.codigo ?? "");

  // Texto de hoy en zona local del usuario
  const hoy = openingTextTodayLocal(userLocale);

  // Armar líneas compactas
  const lineaRango = `Min: <strong>${minFmt} ${codigoInput}</strong> • Max: <strong>${maxFmt} ${codigoInput}</strong>`;
  const lineaRef   = (!ops.allowWhats) ? `⚠ Modo referencia — tasa no vigente` : "";
  const lineaHoy   = `🕒 ${hoy.replace("Horario de Hoy: ", "")}`;

  // Render (máx 3 líneas, cada una en su bloque para que corte bien en móviles)
  DOM.ayudaMonto.innerHTML = `
    <span class="block">${lineaRango}</span>
    ${lineaRef ? `<span class="block">${lineaRef}</span>` : ``}
    <span class="block">${lineaHoy}</span>
  `;
}

function validarMontoEnVivo() {
  
  let raw = DOM.inputMonto.value.trim();

// Prevenir múltiples ceros a la izquierda
if (/^0\d+/.test(raw)) {
  raw = raw.replace(/^0+(?!\.)/, ""); // solo deja 0 si es un decimal válido
  DOM.inputMonto.value = raw;  // actualiza el campo en vivo
}

const monto = parseFloat(raw.replace(",", ".")); // sigue normal

  updateAyudaRangos();
  if (!raw) { DOM.btnCalcular.disabled = true; setInputStyle({ state: "neutral" }); return; }
  const num = parseFloat(raw);
  if (!Number.isFinite(num) || num <= 0) {
    DOM.btnCalcular.disabled = true;
    setInputStyle({ state: "error", msg: "Ingresa un número mayor que 0." });
    return;
  }
  const t = Number(tasa);
  const listo = !!mode && Number.isFinite(tasaCompraUSD) && Number.isFinite(t) && t > 0;
  if (!listo) { DOM.btnCalcular.disabled = true; setInputStyle({ state: "neutral" }); return; }
  const montoEnPesos = mode === "enviar" ? num : calcularCruce(origenSeleccionado, destinoSeleccionado, mode, num, t);
  const usd = montoEnPesos / tasaCompraUSD;
  if (usd < CONFIG.MIN_USD) {
    DOM.btnCalcular.disabled = true;
    setInputStyle({ state: "error", msg: `El mínimo equivalente es ${CONFIG.MIN_USD} USD (ahora llevas ~${usd.toFixed(2)} USD).` });
    return;
  }
  if (usd > CONFIG.MAX_USD) {
    DOM.btnCalcular.disabled = true;
    setInputStyle({ state: "error", msg: `El máximo equivalente es ${CONFIG.MAX_USD} USD (ahora llevas ~${usd.toFixed(2)} USD).` });
    return;
  }
  
  
  DOM.btnCalcular.disabled = false;
  setInputStyle({ state: "ok" });
}

function resetearCampoMonto() {
  DOM.inputMonto.value = "";
  DOM.errorMonto.classList.add("hidden");
  setInputStyle({ state: "neutral" });
  updateAyudaRangos();
}

function actualizarHeader(texto = "") {
  DOM.subtituloHeader.textContent = texto;
  DOM.mainHeader.classList.remove("hidden");
}

function ocultarTodo() {
  DOM.step1Origen.classList.add("hidden");
  DOM.step2Destino.classList.add("hidden");
  DOM.step1.classList.add("hidden");
  DOM.step2.classList.add("hidden");
  DOM.tasaWrap.classList.add("hidden");
  DOM.resultado.classList.add("hidden");
}

export function mostrarPaso1() {
  showBack(false);
  ocultarTodo();
  actualizarHeader("Selecciona el país de origen");
  DOM.btnVolverGlobal.classList.add("hidden");
  DOM.step1Origen.classList.remove("hidden");
  DOM.step1Origen.classList.add("fade-slide-in");
  DOM.origenBtns.innerHTML = "";
  paisesDisponibles.forEach(p => {
    const btn = document.createElement("button");
    btn.textContent = `${p.emoji} ${p.nombre}`;
    btn.className = "ripple-button border rounded-xl px-6 py-3 font-semibold shadow transition hover:scale-105 " +
  "bg-white/80 text-[#0066FF] border-[#0066FF]/50 " +
  "dark:bg-white/10 dark:text-[#9cc2ff] dark:border-[#66a3ff]/40 " +
  "backdrop-blur-sm dark:hover:bg-white/15";
    btn.onclick = () => { origenSeleccionado = p.codigo; mostrarPaso2(); };
    DOM.origenBtns.appendChild(btn);
  });
}

function mostrarPaso2() {
  showBack(true);
  ocultarTodo();
  actualizarHeader("Selecciona el país destino");
  DOM.btnVolverGlobal.classList.remove("hidden");
  DOM.step2Destino.classList.remove("hidden");
  DOM.step2Destino.classList.add("fade-slide-in");
  DOM.destinoBtns.innerHTML = "";
  paisesDisponibles.filter(p => p.codigo !== origenSeleccionado).forEach(p => {
    const btn = document.createElement("button");
    btn.textContent = `${p.emoji} ${p.nombre}`;
    btn.className = "ripple-button border rounded-xl px-6 py-3 font-semibold shadow transition hover:scale-105 " +
  "bg-white/80 text-[#0066FF] border-[#0066FF]/50 " +
  "dark:bg-white/10 dark:text-[#9cc2ff] dark:border-[#66a3ff]/40 " +
  "backdrop-blur-sm dark:hover:bg-white/15";
    btn.onclick = () => { destinoSeleccionado = p.codigo; DOM.step2Destino.classList.add("hidden"); mostrarPaso3(); };
    DOM.destinoBtns.appendChild(btn);
  });
}

async function mostrarPaso3() {
  showBack(true);
  ocultarTodo();
  DOM.step1.classList.remove("hidden");
  DOM.btnVolverGlobal.classList.remove("hidden");
  DOM.mainHeader.classList.remove("hidden");
  DOM.tasaWrap.classList.remove("hidden");
  actualizarHeader("Selecciona el tipo de operación");
  actualizarTextosUI();

  const [{ tasa: tasaCruda, compra, fecha }, manual] = await Promise.all([
    obtenerTasa(origenSeleccionado, destinoSeleccionado),  // {tasa, compra, fecha}
    obtenerStatus()                                       // {open|null, message}
  ]);

  const tNum = Number(tasaCruda);
  const tieneTasa = Number.isFinite(tNum) && tNum > 0;
  if (Number.isFinite(compra)) tasaCompraUSD = compra;

  // === Evaluación operativa ===
  ops = evaluateOps(fecha, manual);
  updateHorarioPill();
  updateWhatsButton();

  // UI de banners segun estado
  if (tieneTasa) {
    tasa = tNum;
    DOM.tasaValue.textContent = formatearTasa(tasa);
    DOM.tasaFecha.textContent = formatearFecha(fecha);

    if (ops.fresh) {
      hideBanner(DOM.tasaAdvertencia);
      DOM.tasaConfirmacionTexto.textContent = "✅ Tasa actualizada";
      mostrarConfirmacionVerdeAutoOcultar(DOM.tasaConfirmacion, 4000);
    } else {
      hideBanner(DOM.tasaConfirmacion);
      DOM.tasaAdvertenciaTexto.textContent = "Tasa desactualizada";
      showBanner(DOM.tasaAdvertencia);
    }

    // Ahora SIEMPRE dejamos elegir modo (aunque sea referencia)
    setModoButtonsEnabled(true);
    updateAyudaRangos();
    validarMontoEnVivo();

    DOM.tasaValue.classList.add("animate-pulse");
    setTimeout(() => DOM.tasaValue.classList.remove("animate-pulse"), 1000);

  } else {
    // Sin tasa → referencia con aviso
    tasa = null;
    setModoButtonsEnabled(false);
    DOM.tasaValue.textContent = "⚠️ No disponible";
    DOM.tasaFecha.textContent = "—";
    hideBanner(DOM.tasaConfirmacion);
    DOM.tasaAdvertenciaTexto.textContent = "No hay tasa disponible";

    setTimeout(() => {
      DOM.loader.classList.add("hidden");
      DOM.resultado.classList.remove("hidden");
      DOM.resultado.classList.add("fade-scale-in");
      DOM.resText.classList.add("text-4xl");
      updateHorarioPill(); // mantiene el pill al día
    }, 1200);

    showBanner(DOM.tasaAdvertencia);
    updateAyudaRangos();
    validarMontoEnVivo();
  }
}

function cambiarPaso(tipo) {
  mode = tipo;
  const { preguntaEnviar, preguntaLlegar } = textosSegunPaises();
  DOM.preguntaMonto.textContent = tipo === "enviar" ? preguntaEnviar : preguntaLlegar;

  resetearCampoMonto();
  updateAyudaRangos();

  // Si estamos en referencia, avisamos pero dejamos continuar
  if (!ops.allowWhats) {
    mostrarToast(DOM, "⚠️ Modo referencia: cálculos orientativos. WhatsApp deshabilitado.");
  }

  DOM.preguntaMonto.classList.remove("opacity-0", "translate-y-4");
  DOM.preguntaMonto.classList.add("opacity-100", "translate-y-0");
  DOM.step1.classList.add("hidden");
  DOM.step2.classList.remove("hidden");
  setTimeout(() => { DOM.inputMonto.focus(); validarMontoEnVivo(); }, 300);
}
function ejecutarCalculo() {
  const raw = DOM.inputMonto.value.trim();
  const monto = parseFloat(raw);
  const t = parseFloat(tasa);
  if (isNaN(monto)) {
    DOM.errorMonto.textContent = "⚠️ Ingresa un número válido";
    DOM.errorMonto.classList.remove("hidden");
    return;
  }
  if (isNaN(t) || t <= 0) {
    DOM.errorMonto.textContent = "⚠️ Tasa No Disponible.";
    DOM.errorMonto.classList.remove("hidden");
    return;
  }
  if (!tasaCompraUSD) {
    DOM.errorMonto.textContent = "⚠️ No se pudo obtener la tasa de compra en USD.";
    DOM.errorMonto.classList.remove("hidden");
    return;
  }

  const montoEnPesos = mode === "enviar"
    ? monto
    : calcularCruce(origenSeleccionado, destinoSeleccionado, mode, monto, t);
  const usd = montoEnPesos / tasaCompraUSD;

  if (usd < CONFIG.MIN_USD) {
    DOM.errorMonto.textContent = `⚠️ El monto mínimo permitido es equivalente a ${CONFIG.MIN_USD} USD`;
    DOM.errorMonto.classList.remove("hidden");
    return;
  }

  if (usd > CONFIG.MAX_USD) {
    DOM.errorMonto.textContent = `⚠️ El monto máximo permitido es equivalente a ${CONFIG.MAX_USD} USD`;
    DOM.errorMonto.classList.remove("hidden");
    return;
  }

  if (!ops.allowWhats) {
    mostrarToast(DOM, "⚠️ Modo referencia: valores orientativos.");
  }

  DOM.errorMonto.classList.add("hidden");

  const o = obtenerPais(origenSeleccionado);
  const d = obtenerPais(destinoSeleccionado);
  const calc = Math.round(calcularCruce(origenSeleccionado, destinoSeleccionado, mode, monto, t));
  const calcRed = mode === "llegar" ? redondearPorMoneda(calc, o.codigo) : calc;

  const fecha = DOM.tasaFecha.textContent;
  const montoFmt = new Intl.NumberFormat(userLocale, { maximumFractionDigits: 2 }).format(monto);
  const calcFmt = new Intl.NumberFormat(userLocale, { maximumFractionDigits: 0 }).format(calcRed);
  const tasaFmt = formatearTasa(tasa);

  lastCalc = {
    mode,
    origen: o,
    destino: d,
    montoIngresado: monto,
    montoCalculado: calcRed,
    tasa: t,
    fecha
  };

  const refBadge = !ops.allowWhats
    ? `<div class="mt-2 inline-block text-xs font-bold text-red-700 bg-red-100 border border-red-300 rounded px-2 py-1">MODO REFERENCIA</div>`
    : ``;

  const mensaje = mode === "enviar"
    ? `<div class="text-sm italic text-gray-500 dark:text-gray-400">Enviando desde ${o.nombre}</div>
       <div class="text-3xl font-semibold text-blue-800 dark:text-blue-400">$${montoFmt} ${o.codigo}</div>
       <div class="text-base text-gray-600 dark:text-gray-300 mt-1">recibirás</div>
       <div class="text-4xl font-extrabold text-blue-900 dark:text-blue-200">${d.codigo} ${calcFmt}</div>
       ${refBadge}
       <div class="text-sm italic text-gray-500 dark:text-gray-400 mt-4">Calculado con la tasa del día ${fecha} — <span class="font-semibold text-blue-800 dark:text-blue-400">${tasaFmt}</span></div>`
    : `<div class="text-sm italic text-gray-500 dark:text-gray-400">Para recibir en ${d.nombre}</div>
       <div class="text-3xl font-semibold text-blue-800 dark:text-blue-400">${d.codigo} ${montoFmt}</div>
       <div class="text-base text-gray-600 dark:text-gray-300 mt-1">debes enviar</div>
       <div class="text-4xl font-extrabold text-blue-900 dark:text-blue-200">$${calcFmt} ${o.codigo}</div>
       ${refBadge}
       <div class="text-sm italic text-gray-500 dark:text-gray-400 mt-4">Calculado con la tasa del día ${fecha} — <span class="font-semibold text-blue-800 dark:text-blue-400">${tasaFmt}</span></div>`;

  DOM.resText.innerHTML = mensaje;
  if (ops.allowWhats && !DOM.soundSuccess.muted) DOM.soundSuccess.play();

  DOM.step2.classList.add("hidden");
  DOM.tasaWrap.classList.add("transition", "duration-500", "ease-out", "opacity-0", "scale-95");
  setTimeout(() => DOM.tasaWrap.classList.add("hidden"), 500);

  DOM.loader.classList.remove("hidden");
  setTimeout(() => {
    DOM.loader.classList.add("hidden");
    DOM.resultado.classList.remove("hidden");
    DOM.resultado.classList.add("fade-scale-in");
    DOM.resText.classList.add("text-4xl");
    updateWhatsButton();
  }, 1200);
}

export function wireEvents() {
  (() => {
    const isDark = document.documentElement.classList.contains("dark");
    DOM.btnToggleDark.textContent = isDark ? "🌞 Claro" : "🌙 Oscuro";
  })();
  DOM.btnToggleDark.addEventListener("click", () => {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    DOM.btnToggleDark.textContent = isDark ? "🌞 Claro" : "🌙 Oscuro";
  });

  DOM.btnEnviar.onclick = () => cambiarPaso("enviar");
  DOM.btnLlegar.onclick = () => cambiarPaso("llegar");

  // Handler ÚNICO del botón Volver (sin duplicados)
    DOM.btnVolverGlobal.onclick = () => {
    const isStep1Visible = !DOM.step1.classList.contains("hidden");
    const isStep2Visible = !DOM.step2.classList.contains("hidden");
    const isResultadoVisible = !DOM.resultado.classList.contains("hidden");

    if (isResultadoVisible) {
      DOM.resultado.classList.add("hidden");
      DOM.resultado.classList.remove("fade-scale-in");

      DOM.step2.classList.remove("hidden");
      DOM.tasaWrap.classList.remove("hidden", "opacity-0", "scale-95");

      actualizarHeader("Ingresa el monto");
      setTimeout(() => {
        DOM.inputMonto.focus();
        validarMontoEnVivo();
      }, 200);
      return;
    }

    if (isStep2Visible) {
      DOM.step2.classList.add("hidden");
      DOM.step1.classList.remove("hidden");
      actualizarHeader("Selecciona el tipo de operación");
      return;
    }

    if (isStep1Visible) {
      mostrarPaso2();
      return;
    }

    mostrarPaso1();
  };

  // Autoscroll input al abrir teclado (centrado)
  let scrollPrev = 0;
  DOM.inputMonto.addEventListener("focus", () => {
    scrollPrev = window.scrollY;
    setTimeout(() => DOM.inputMonto.scrollIntoView({ behavior: "smooth", block: "center" }), 380);
    updateAyudaRangos();
  });
  DOM.inputMonto.addEventListener("blur", () => {
    DOM.errorMonto.classList.add("hidden");
    setTimeout(() => window.scrollTo({ top: scrollPrev, behavior: "smooth" }), 150);
  });
  DOM.inputMonto.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); DOM.btnCalcular.click(); }
  });
  DOM.inputMonto.addEventListener("input", () => {
    let val = DOM.inputMonto.value.replace(/,/g, ".").replace(/[^0-9.]/g, "");
    const parts = val.split(".");
    if (parts.length > 2) val = parts[0] + "." + parts[1];
    if (parts[1]?.length > 2) val = parts[0] + "." + parts[1].slice(0, 2);
    DOM.inputMonto.value = val;

    const num = parseFloat(val), maxVal = maxPermitidoEnInput();
    if (Number.isFinite(num) && Number.isFinite(maxVal) && num > maxVal) {
      const capped = Math.floor(maxVal * 100) / 100;
      DOM.inputMonto.value = String(capped);
    }
    validarMontoEnVivo();
  });

  DOM.btnCalcular.onclick = () => {
  const raw = DOM.inputMonto.value.trim();
  const monto = parseFloat(raw);
  const montoEnPesos = mode === "enviar" ? monto : calcularCruce(origenSeleccionado, destinoSeleccionado, mode, monto, tasa);
  const usd = montoEnPesos / tasaCompraUSD;

  if (usd >= 300 && !document.body.classList.contains("modal-activo")) {
    mostrarModalMontoGrande(() => ejecutarCalculo());
    return;
  }

  ejecutarCalculo();
};


  DOM.btnRecalcular.onclick = () => {
    resetearCampoMonto();
    DOM.resText.classList.remove("text-4xl");
    DOM.resultado.classList.add("hidden");
    DOM.resultado.classList.remove("fade-scale-in");
    if (origenSeleccionado && destinoSeleccionado && mode) {
      DOM.step1.classList.add("hidden");
      DOM.step2.classList.remove("hidden");
      DOM.tasaWrap.classList.remove("hidden");
      actualizarHeader("Ingresa el monto");
      setTimeout(() => {
        DOM.inputMonto.focus();
        validarMontoEnVivo();
        DOM.tasaWrap.classList.remove("opacity-0", "scale-95");
      }, 200);
      return;
    }
    mostrarPaso1();
  };

  // iniciar flujo
  mostrarPaso1();
}

export function getLastCalc() { return lastCalc; }

// Nuevo: expone si WhatsApp está habilitado (para sharing.js)
export function getOpsState() { return ops; }
