// main.js — Panel Admin ByteTransfer (reemplazo completo)
// ------------------------------------------------------
"use strict";

console.log("✅ Admin cargado");

// -------------------------
// Configuración y estado
// -------------------------
const paises = [
  { fiat: "ARS", nombre: "Argentina", emoji: "🇦🇷" },
  { fiat: "COP", nombre: "Colombia", emoji: "🇨🇴" },
  { fiat: "MXN", nombre: "México", emoji: "🇲🇽" },
  { fiat: "PEN", nombre: "Perú", emoji: "🇵🇪" },
  { fiat: "CLP", nombre: "Chile", emoji: "🇨🇱" },
  { fiat: "BRL", nombre: "Brasil", emoji: "🇧🇷" },
  { fiat: "VES", nombre: "Venezuela", emoji: "🇻🇪" }
];

const ajustesPorDefecto = { ARS: 8, COP: 8, MXN: 15, PEN: 7, CLP: 7, BRL: 8, VES: 4 };

// Estado en memoria
let datosPaises = {};          // { ARS:{compra,venta,ajuste}, ... }
let snapshotPrevio = {};       // snapshot cargado de /api/snapshot
let crucesAnteriores = {};     // { "ARS-COP": tasa, ... } (histórico previo para variación)
let modoEdicionActivo = false;
let filtroPais = null;         // ej. "ARS" para filtrar
let rolVista = "origen";       // "origen" | "destino"
let llamadasPendientes = 0;
let timerAdvertencia = null;

// -------------------------
// Utilidades
// -------------------------
function formatearTasa(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n >= 10) return +n.toFixed(1);
  if (n >= 1) return +n.toFixed(2);
  if (n >= 0.01) return +n.toFixed(3);
  if (n >= 0.001) return +n.toFixed(4);
  if (n >= 0.00099) return +n.toFixed(5);
  return +n.toFixed(6);
}
function iconoCambio(n, p) {
  if (p == null || !Number.isFinite(p)) return "⏺";
  if (n > p) return "🔼";
  if (n < p) return "🔽";
  return "⏺";
}
function claseCambio(n, p) {
  if (p == null || !Number.isFinite(p)) return "text-blue-600";
  if (n > p) return "text-green-600";
  if (n < p) return "text-red-600";
  return "text-blue-600";
}
function mostrarToast(msg) {
  const el = document.getElementById("toastMensaje");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
  el.style.opacity = "1";
  el.style.transform = "scale(1)";
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "scale(0.95)";
    setTimeout(() => {
      el.classList.add("hidden");
      el.textContent = "";
    }, 300);
  }, 3500);
}
function mostrarAdvertenciaPendiente(mostrar = true) {
  const adv = document.getElementById("advertencia-pendiente");
  if (adv) adv.classList.toggle("hidden", !mostrar);
}
function manejarFinDeLlamadas() {
  if (llamadasPendientes === 0) {
    if (timerAdvertencia) clearTimeout(timerAdvertencia);
    timerAdvertencia = setTimeout(() => {
      mostrarAdvertenciaPendiente(true);
    }, 250);
  }
}

// -------------------------
// Carga/guardado de snapshot
// -------------------------
async function cargarSnapshot() {
  try {
    const res = await fetch("/api/snapshot", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    snapshotPrevio = json || {};
    // Copiamos países existentes y aseguramos estructura
    datosPaises = {};
    for (const p of paises) {
      const sp = snapshotPrevio[p.fiat] || {};
      datosPaises[p.fiat] = {
        compra: Number.isFinite(sp.compra) ? sp.compra : null,
        venta:  Number.isFinite(sp.venta)  ? sp.venta  : null,
        ajuste: Number.isFinite(sp.ajuste) ? sp.ajuste : (sp.ajuste ?? ajustesPorDefecto[p.fiat])
      };
    }
    crucesAnteriores = snapshotPrevio.cruces || {};

    if (json.timestamp) {
      const f = new Date(json.timestamp);
      const el = document.getElementById("ultima-actualizacion");
      if (el) el.textContent = `🕒 Última actualización: ${f.toLocaleString()}`;
    }
  } catch (err) {
    console.error("❌ cargarSnapshot", err);
    mostrarToast("❌ No se pudo cargar el snapshot");
  }
}

async function guardarSnapshot(datos) {
  try {
    const body = { ...datos, cruces: crucesAnteriores };
    const res = await fetch("/api/guardar-snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    console.log("💾 Snapshot guardado");
  } catch (err) {
    console.error("❌ guardarSnapshot", err);
    mostrarToast("❌ Error al guardar el snapshot");
  }
}

// -------------------------
// Binance
// -------------------------
async function fetchPrecio(fiat, tipo) {
  // BRL con fallback estático (opcional)
  if (fiat === "BRL") return tipo === "BUY" ? 5.74 : 5.49;

  const USDT_LIMITE_VES = 150;
  const precios = [];
  try {
    // Caso particular: VES SELL basado en BUY (ajuste pequeño para spread)
    if (tipo === "SELL" && fiat === "VES") {
      const precioCompra = await fetchPrecio(fiat, "BUY");
      if (!precioCompra) return null;
      return parseFloat((precioCompra * 0.9975).toFixed(6));
    }

    const res = await fetch("/api/binance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fiat, tradeType: tipo, rows: 100 })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const comerciales = j.data || [];

    for (const item of comerciales) {
      const adv = item?.adv;
      if (!adv) continue;

      const precio = parseFloat(adv.price);
      const minVES = parseFloat(adv.minSingleTransAmount) || Infinity;
      const permitido = !adv.isAdvBanned;

      if (!precio || !permitido) continue;

      if (fiat === "VES" && tipo === "SELL") {
        const usdtNecesario = minVES / precio;
        if (usdtNecesario > USDT_LIMITE_VES) continue;
      }

      precios.push(precio);
      if (precios.length === 20) break; // top 20 válidos
    }

    if (!precios.length) return null;
    const promedio = precios.reduce((a, b) => a + b, 0) / precios.length;
    return parseFloat(promedio.toFixed(6));
  } catch (e) {
    console.error("❌ fetchPrecio:", fiat, tipo, e.message || e);
    return null;
  }
}

// -------------------------
// Render tarjetas (compra/venta/ajuste)
// -------------------------
function renderTarjetasPaises(modoEdicion = false) {
  const cont = document.getElementById("tarjetas-paises") || document.createElement("div");
  cont.id = "tarjetas-paises";
  cont.className = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-6 mb-8";

  // si existe tabla vieja, la removemos (por migraciones anteriores)
  const tablaAntigua = document.getElementById("tabla-paises-body")?.parentElement?.parentElement;
  if (tablaAntigua) tablaAntigua.remove();

  cont.innerHTML = "";

const renderInput = (valor, color, tipo, fiat) => {
  const claseColor = color === "green" ? "text-green-900" : "text-red-900";
  const texto = formatearTasa(valor);
  if (!modoEdicion) {
    return `<div class="mt-1 font-bold text-xl sm:text-2xl leading-tight ${claseColor} break-words truncate max-w-full">${texto}</div>`;
  }
  return `
    <input type="number"
      step="any"
      data-fi="${fiat}"
      data-tipo="${tipo}"
      value="${valor ?? ""}"
      class="w-full px-2 py-1 mt-1 border border-gray-300 rounded-md text-center text-black bg-white ${claseColor}
             text-sm truncate focus:outline-none focus:ring-2 focus:ring-blue-400" />
  `;
};


  paises.forEach(p => {
    const datos = datosPaises[p.fiat] || {};
    const compra = datos.compra;
    const venta  = datos.venta;
    const ajuste = datos.ajuste ?? ajustesPorDefecto[p.fiat];
    const emoji = p.emoji || "🌐";

    const tarjeta = document.createElement("div");
    tarjeta.className = "backdrop-card text-gray-900 p-3 sm:p-4 flex flex-col justify-between min-h-[140px]";

    tarjeta.innerHTML = `
      <div>
        <h3 class="text-sm font-semibold tracking-wide mb-2">${emoji} ${p.nombre} (${p.fiat})</h3>
        <div class="flex flex-col gap-2">
          <div class="flex-1 bg-green-100 border border-green-300 rounded-md p-2 text-center text-xs">
            <h4 class="text-[11px] font-medium text-green-700">Compra</h4>
            ${renderInput(compra, "green", "compra", p.fiat)}
          </div>
          <div class="flex-1 bg-red-100 border border-red-300 rounded-md p-2 text-center text-xs">
            <h4 class="text-[11px] font-medium text-red-700">Venta</h4>
            ${renderInput(venta, "red", "venta", p.fiat)}
          </div>
        </div>
      </div>
      <div class="mt-2 text-[11px] text-black-700 flex justify-between items-center">
        <span>Ajuste (%)</span>
        ${
          modoEdicion
            ? `<input type="number"
                 step="any"
                 data-fi="${p.fiat}"
                 data-tipo="ajuste"
                 value="${ajuste}"
                 class="w-24 text-center font-semibold text-sm px-2 py-1.5 rounded-md border border-gray-300 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
 
 />`
            : `<div class="w-12 text-right font-semibold text-gray-800">${ajuste} %</div>`
        }
      </div>
    `;
    cont.appendChild(tarjeta);
  });

  // listeners de inputs creados (activar advertencia)
  setTimeout(() => {
    const inputs = cont.querySelectorAll("input[data-fi]");
    inputs.forEach(input => {
      input.addEventListener("input", () => mostrarAdvertenciaPendiente(true));
    });
  }, 0);

  // insertar si no estaba en el DOM
  const wrapper = document.querySelector(".max-w-5xl");
  if (wrapper && !wrapper.contains(cont)) wrapper.appendChild(cont);
}

// -------------------------
// Cálculo de cruces
// -------------------------
function escribirCruces() {
  const cont = document.getElementById("cruces-container");
  if (!cont) return;
  cont.innerHTML = "";
  cont.className = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-5 mt-8";

  // aseguramos que datosPaises tenga entradas solo para los países definidos
  const activos = new Set(paises.map(p => p.fiat));

  activos.forEach(origen => {
    activos.forEach(destino => {
      if (origen === destino) return;

      const o = datosPaises[origen];
      const d = datosPaises[destino];
      if (!o || !d || !o.compra || !d.venta) return;

      // ajuste por país origen (si falta, usa por defecto)
      const ajuste = Number.isFinite(o.ajuste) ? o.ajuste : ajustesPorDefecto[origen];
      datosPaises[origen].ajuste = ajuste;

      // tasa base: normalmente d.venta / o.compra
      // excepción COP->VES: invertir relación base
      let tasaBase = (destino === "VES" && origen === "COP")
        ? 1 / (d.venta / o.compra)
        : d.venta / o.compra;

      // aplicar ajuste: COP->VES suma %, resto resta %
      const factor =
        (origen === "COP" && destino === "VES")
          ? (1 + ajuste / 100)
          : (1 - ajuste / 100);

      const tasaFinal = parseFloat((tasaBase * factor).toFixed(6));

      const clave = `${origen}-${destino}`;
      const anterior = crucesAnteriores[clave];
      crucesAnteriores[clave] = tasaFinal;

      if (filtroPais) {
        if (rolVista === "origen" && origen !== filtroPais) return;
        if (rolVista === "destino" && destino !== filtroPais) return;
      }

      const color = claseCambio(tasaFinal, anterior);
      const emoji = iconoCambio(tasaFinal, anterior);
      const flagOrigen  = paises.find(p => p.fiat === origen)?.emoji || "";
      const flagDestino = paises.find(p => p.fiat === destino)?.emoji || "";

      const card = document.createElement("div");
      card.className = "relative backdrop-card p-3 text-sm sm:text-base transition-transform duration-200 hover:scale-[1.01]";
      card.innerHTML = `
        <span class="absolute top-2 right-2 text-xs sm:text-sm opacity-70 ${color} select-none pointer-events-none">${emoji}</span>

        <div class="flex justify-center">
          <h4 class="text-xs sm:text-sm font-semibold text-center">
            <span class="inline-flex items-center gap-1">
              <span>${flagOrigen}</span><span class="font-medium">${origen}</span>
              <span class="text-gray-400">→</span>
              <span>${flagDestino}</span><span class="font-medium">${destino}</span>
            </span>
          </h4>
        </div>

        <div class="mt-2 text-center">
          <span class="block font-mono tabular-nums ${color} text-2xl sm:text-3xl font-extrabold leading-tight break-all">
            ${formatearTasa(tasaFinal)}
          </span>
        </div>

        <div class="mt-2 grid grid-cols-2 gap-2 text-[11px] sm:text-xs text-gray-600">
          <div class="flex items-center gap-1 min-w-0 whitespace-nowrap">
            <span class="text-gray-500">Tasa base</span>:
            <span class="font-mono tabular-nums truncate max-w-[100px] sm:max-w-[140px]">${formatearTasa(tasaBase)}</span>
          </div>
          <div class="text-right whitespace-nowrap">
            <span class="text-gray-500">Ajuste</span>: ${ajuste}%
          </div>
        </div>
      `;
      cont.appendChild(card);
    });
  });
}

// -------------------------
// Popover y filtros
// -------------------------
function openPopover() {
  const pop = document.getElementById("popover-paises");
  const btn = document.getElementById("btn-seleccionar-pais");
  if (!pop || !btn) return;
  const rect = btn.getBoundingClientRect();
  pop.style.top = `${rect.bottom + 4}px`;
  pop.style.left = `${rect.left}px`;
  pop.classList.remove("hidden");
}
function closePopover() {
  const pop = document.getElementById("popover-paises");
  if (pop) pop.classList.add("hidden");
}
function resetFiltros() {
  filtroPais = null;
  rolVista = "origen";
  const label = document.getElementById("pais-seleccionado");
  if (label) label.innerText = "Todos";
  const tabO = document.getElementById("tab-origen");
  const tabD = document.getElementById("tab-destino");
  if (tabO) tabO.className = "px-4 py-2 bg-white text-blue-600 font-semibold";
  if (tabD) tabD.className = "px-4 py-2 bg-gray-100 text-gray-600";
  escribirCruces();
}
function initPopover() {
  const ul = document.getElementById("lista-paises");
  if (!ul) return;
  ul.innerHTML = "";
  paises.forEach(p => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = "w-full text-left p-3 hover:bg-blue-50";
    btn.innerText = `${p.nombre} (${p.fiat})`;
    btn.dataset.fi = p.fiat;
    btn.addEventListener("click", () => {
      filtroPais = p.fiat;
      const label = document.getElementById("pais-seleccionado");
      if (label) label.innerText = p.nombre;
      closePopover();
      escribirCruces();
    });
    li.appendChild(btn);
    ul.appendChild(li);
  });

  document.addEventListener("click", e => {
    const pop = document.getElementById("popover-paises");
    const btn = document.getElementById("btn-seleccionar-pais");
    if (!pop || !btn) return;
    if (!pop.contains(e.target) && !btn.contains(e.target)) {
      closePopover();
    }
  });
}

// -------------------------
// Eventos UI (panel admin)
// -------------------------
document.getElementById("btn-seleccionar-pais")?.addEventListener("click", e => {
  e.stopPropagation();
  openPopover();
});
document.getElementById("btn-resetear")?.addEventListener("click", resetFiltros);

document.getElementById("tab-origen")?.addEventListener("click", () => {
  rolVista = "origen";
  const tabO = document.getElementById("tab-origen");
  const tabD = document.getElementById("tab-destino");
  if (tabO) tabO.className = "px-4 py-2 bg-white text-blue-600 font-semibold";
  if (tabD) tabD.className = "px-4 py-2 bg-gray-100 text-gray-600";
  escribirCruces();
});
document.getElementById("tab-destino")?.addEventListener("click", () => {
  rolVista = "destino";
  const tabO = document.getElementById("tab-origen");
  const tabD = document.getElementById("tab-destino");
  if (tabD) tabD.className = "px-4 py-2 bg-white text-blue-600 font-semibold";
  if (tabO) tabO.className = "px-4 py-2 bg-gray-100 text-gray-600";
  escribirCruces();
});

document.getElementById("btn-toggle-edicion")?.addEventListener("click", () => {
  modoEdicionActivo = !modoEdicionActivo;
  renderTarjetasPaises(modoEdicionActivo);
  mostrarAdvertenciaPendiente(false);
  const btn = document.getElementById("btn-toggle-edicion");
  if (btn) btn.textContent = modoEdicionActivo ? "🔒 Finalizar Edición" : "✏️ Editar Precios";
});

document.getElementById("btn-refrescar")?.addEventListener("click", () => {
  document.getElementById("modal-confirmacion")?.classList.remove("hidden");
});
function cerrarModalConfirmacion() {
  document.getElementById("modal-confirmacion")?.classList.add("hidden");
}
document.getElementById("btn-cancelar-binance")?.addEventListener("click", cerrarModalConfirmacion);

document.getElementById("btn-confirmar-binance")?.addEventListener("click", async () => {
  cerrarModalConfirmacion();

  // 1) Persistimos ajustes escritos en inputs (si estamos en edición)
  for (const p of paises) {
    const fiat = p.fiat;
    if (!datosPaises[fiat]) datosPaises[fiat] = {};
    const inputAjuste = document.querySelector(`input[data-fi="${fiat}"][data-tipo="ajuste"]`);
    const ajusteNuevo = inputAjuste ? parseFloat(inputAjuste.value) : null;
    const ajustePrevio = datosPaises[fiat].ajuste;
    datosPaises[fiat].ajuste =
      Number.isFinite(ajusteNuevo) ? ajusteNuevo : (Number.isFinite(ajustePrevio) ? ajustePrevio : ajustesPorDefecto[fiat]);
    // limpiar compra/venta para rellenar con nuevos valores
    datosPaises[fiat].compra = null;
    datosPaises[fiat].venta  = null;
  }
  renderTarjetasPaises(modoEdicionActivo);

  // 2) Traemos precios (secuencial, robusto) y solo renderizamos al final
  llamadasPendientes = paises.length * 2;
  for (const p of paises) {
    const fiat = p.fiat;
    const compra = await fetchPrecio(fiat, "BUY");
    llamadasPendientes--;
    const venta  = await fetchPrecio(fiat, "SELL");
    llamadasPendientes--;
    datosPaises[fiat].compra = compra;
    datosPaises[fiat].venta  = venta;
  }
  manejarFinDeLlamadas();
  renderTarjetasPaises(modoEdicionActivo);
  escribirCruces();
});

document.getElementById("btn-aplicar-ajustes")?.addEventListener("click", () => {
  for (const p of paises) {
    const fiat = p.fiat;
    const ajuste = parseFloat(document.querySelector(`input[data-fi="${fiat}"][data-tipo="ajuste"]`)?.value);
    const compra = parseFloat(document.querySelector(`input[data-fi="${fiat}"][data-tipo="compra"]`)?.value);
    const venta  = parseFloat(document.querySelector(`input[data-fi="${fiat}"][data-tipo="venta"]`)?.value);

    if (!datosPaises[fiat]) datosPaises[fiat] = {};
    if (Number.isFinite(ajuste)) datosPaises[fiat].ajuste = ajuste;
    else datosPaises[fiat].ajuste = datosPaises[fiat].ajuste ?? ajustesPorDefecto[fiat];

    if (Number.isFinite(compra)) datosPaises[fiat].compra = compra;
    if (Number.isFinite(venta))  datosPaises[fiat].venta  = venta;
  }
  renderTarjetasPaises(modoEdicionActivo);
  escribirCruces();
  mostrarAdvertenciaPendiente(true);
});

document.getElementById("btn-guardar-ajustes")?.addEventListener("click", async () => {
  // Actualizamos datosPaises desde inputs (si están)
  for (const p of paises) {
    const fiat = p.fiat;
    const ajuste = parseFloat(document.querySelector(`input[data-fi="${fiat}"][data-tipo="ajuste"]`)?.value);
    const compra = parseFloat(document.querySelector(`input[data-fi="${fiat}"][data-tipo="compra"]`)?.value);
    const venta  = parseFloat(document.querySelector(`input[data-fi="${fiat}"][data-tipo="venta"]`)?.value);

    if (!datosPaises[fiat]) datosPaises[fiat] = {};
    datosPaises[fiat].ajuste = Number.isFinite(ajuste) ? ajuste : (datosPaises[fiat].ajuste ?? ajustesPorDefecto[fiat]);
    if (Number.isFinite(compra)) datosPaises[fiat].compra = compra;
    if (Number.isFinite(venta))  datosPaises[fiat].venta  = venta;
  }

  await guardarSnapshot({ ...datosPaises, timestamp: new Date().toISOString() });
  snapshotPrevio = JSON.parse(JSON.stringify({ ...datosPaises, cruces: crucesAnteriores }));
  const el = document.getElementById("ultima-actualizacion");
  if (el) el.textContent = `🕒 Última actualización: ${new Date().toLocaleString()}`;

  renderTarjetasPaises(modoEdicionActivo);
  escribirCruces();
  mostrarAdvertenciaPendiente(false);
});

// -------------------------
// Login (placeholder simple)
// -------------------------
const btnLogin = document.getElementById("btnLogin");
const loginEmail = document.getElementById("loginEmail");
const loginPass = document.getElementById("loginPass");
const loginSeccion = document.getElementById("loginSeccion");
const contenidoPrivado = document.getElementById("contenidoPrivado");

function verificarSesion() {
  const token = localStorage.getItem("token");
  if (token) {
    loginSeccion?.classList.add("hidden");
    contenidoPrivado?.classList.remove("hidden");
  } else {
    loginSeccion?.classList.remove("hidden");
    contenidoPrivado?.classList.add("hidden");
  }
}
btnLogin && (btnLogin.onclick = async () => {
  const email = loginEmail?.value.trim();
  const password = loginPass?.value.trim();
  if (!email || !password) return mostrarToast("⚠️ Completa ambos campos");
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      mostrarToast("❌ Usuario o clave incorrecta");
      return;
    }
    const data = await res.json();
    localStorage.setItem("token", data.token);
    mostrarToast("✅ Sesión iniciada");
    verificarSesion();
  } catch (e) {
    console.error(e);
    mostrarToast("❌ Error de conexión");
  }
});
document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("token");
  mostrarToast("🔒 Sesión cerrada");
  verificarSesion();
});

// -------------------------
// Init
// -------------------------
(async () => {
  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "block";

  await cargarSnapshot();
  renderTarjetasPaises(modoEdicionActivo);
  initPopover();
  escribirCruces();

  if (loader) loader.style.display = "none";
  verificarSesion();
})();