console.log("✅ Script cargado");

const paises = [
  { fiat: "ARS", nombre: "Argentina", emoji: "🇦🇷" },
  { fiat: "COP", nombre: "Colombia", emoji: "🇨🇴" },
  { fiat: "MXN", nombre: "México", emoji: "🇲🇽" },
  { fiat: "PEN", nombre: "Perú", emoji: "🇵🇪" },
  { fiat: "CLP", nombre: "Chile", emoji: "🇨🇱" },
  { fiat: "BRL", nombre: "Brasil", emoji: "🇧🇷" },
  { fiat: "VES", nombre: "Venezuela", emoji: "🇻🇪" }
];
const btnLogin = document.getElementById('btnLogin');
const loginEmail = document.getElementById('loginEmail');
const loginPass = document.getElementById('loginPass');
const loginSeccion = document.getElementById('loginSeccion');
const contenidoPrivado = document.getElementById('contenidoPrivado');
const ajustesPorDefecto = { ARS:10, COP:10, MXN:18, PEN:9, CLP:9, BRL:9, VES:2 };
let datosPaises = {}, snapshotPrevio = {}, crucesAnteriores = {};
let llamadasPendientes = 0, timerGuardar = null;
let filtroPais = null, rolVista = "origen";
let modoEdicionActivo = false;


function formatearTasa(v) {
  if (typeof v !== "number" || isNaN(v)) return "-";
  if (v >= 1) return v.toFixed(1);
  if (v >= 0.01) return v.toFixed(3);
  if (v >= 0.00099) return v.toFixed(5);
  return v.toFixed(6);
}

function iconoCambio(n, p) {
  if (p == null) return '';
  if (n > p) return '🔼';
  if (n < p) return '🔽';
  return '⏺';
}
function claseCambio(n, p) {
  if (p == null) return '';
  if (n > p) return 'text-green-600';
  if (n < p) return 'text-red-600';
  return 'text-blue-600';
}

async function cargarSnapshot() {
  try {
    const res = await fetch("/api/snapshot");
    const json = await res.json();
    snapshotPrevio = json || {};
    datosPaises = { ...snapshotPrevio };
    crucesAnteriores = snapshotPrevio.cruces || {};
    if (json.timestamp) {
      const f = new Date(json.timestamp);
      document.getElementById("ultima-actualizacion").textContent = `🕒 Última actualización: ${f.toLocaleString()}`;
    }
  } catch (err) {
    console.error("❌ cargarSnapshot", err);
  }
}

async function guardarSnapshot(datos) {
  try {
    await fetch("/api/guardar-snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...datos, cruces: crucesAnteriores })
    });
    console.log("📦 Snapshot guardado");
  } catch (err) {
    console.error("❌ guardarSnapshot", err);
  }
}

  function renderTarjetasPaises(modoEdicion = false) {
  const cont = document.getElementById("tarjetas-paises") || document.createElement("div");
  cont.id = "tarjetas-paises";
  cont.className = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8";
  const wrapper = document.querySelector(".max-w-5xl");
  const tablaAntigua = document.getElementById("tabla-paises-body")?.parentElement?.parentElement;
  if (tablaAntigua) tablaAntigua.remove();
  wrapper.prepend(cont);
  cont.innerHTML = "";

  paises.forEach(p => {
    const datos = datosPaises[p.fiat] || {};
    const compra = datos.compra;
    const venta = datos.venta;
    const ajuste = datos.ajuste ?? ajustesPorDefecto[p.fiat];
    const emoji = p.emoji || "🌐";

    const tarjeta = document.createElement("div");
    tarjeta.className = "bg-white text-gray-900 shadow-xl rounded-xl p-4 transition-transform hover:scale-[1.02] duration-300 flex flex-col justify-between border border-gray-200 min-h-[240px]";

    const renderInput = (valor, color, tipo, fiat) => {
  const claseColor = color === "green" ? "text-green-900" : "text-red-900";
  const texto = formatearTasa(valor);
  if (!modoEdicion) {
    return `<div class="mt-1 font-semibold ${claseColor}">${texto}</div>`;
  }
  return `
    <input type="number"
      step="any"
      data-fi="${fiat}"
      data-tipo="${tipo}"
      value="${valor ?? ''}"
      class="w-full px-2 py-1 mt-1 border border-gray-300 rounded-md text-center bg-white ${claseColor} focus:outline-none focus:ring-2 focus:ring-blue-400" />
  `;
};

    tarjeta.innerHTML = `
      <div>
        <h3 class="text-lg font-semibold tracking-wide mb-3">${emoji} ${p.nombre} (${p.fiat})</h3>
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-green-100 border border-green-300 shadow-inner rounded-lg p-3 text-center">
            <h4 class="text-sm font-medium text-green-700">Compra</h4>
            ${renderInput(compra, 'green', 'compra', p.fiat)}
          </div>
          <div class="bg-red-100 border border-red-300 shadow-inner rounded-lg p-3 text-center">
            <h4 class="text-sm font-medium text-red-700">Venta</h4>
            ${renderInput(venta, 'red', 'venta', p.fiat)}
          </div>
        </div>
      </div>
      <div class="mt-4 text-sm text-gray-700 flex justify-between items-center">
        <span>Ajuste (%)</span>
        ${modoEdicion ? `
  <input type="number"
    step="any"
    data-fi="${p.fiat}"
    data-tipo="ajuste"
    value="${ajuste}"
    class="w-20 px-2 py-1 border border-gray-300 rounded-md text-right bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
` : `<div class="w-20 text-right font-semibold text-gray-800">${ajuste} %</div>`}
      </div>
    `;

    cont.appendChild(tarjeta);
  });

  // Detectar cambios manuales en cualquier input
  setTimeout(() => {
    const inputs = cont.querySelectorAll("input[data-fi]");
    inputs.forEach(input => {
      input.addEventListener("input", () => {
        mostrarAdvertenciaPendiente(true);
      });
    });
  }, 0);
}

function manejarFinDeLlamadas() {
  if (llamadasPendientes === 0) {
    if (timerGuardar) clearTimeout(timerGuardar);
    timerGuardar = setTimeout(() => {
      mostrarAdvertenciaPendiente(true); // Mostramos la advertencia
    }, 300);
  }
}

function mostrarAdvertenciaPendiente(mostrar = true) {
  const advertencia = document.getElementById("advertencia-pendiente");
  if (advertencia) {
    advertencia.classList.toggle("hidden", !mostrar);
  }
}


async function fetchPrecio(fiat, tipo) {
  if (fiat === "BRL") return tipo === "BUY" ? 5.74 : 5.49;
  const USDT_LIMITE = 150;
  const preciosValidos = [];

  try {
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
    const j = await res.json();
    const comerciales = j.data || [];

    for (const comerciante of comerciales) {
      const { adv } = comerciante;
      const precio = parseFloat(adv.price);
      const minVES = parseFloat(adv.minSingleTransAmount) || Infinity;
      const permitido = !adv.isAdvBanned;
      if (!precio || !permitido) continue;
      if (fiat === "VES" && tipo === "SELL") {
        const usdtNecesario = minVES / precio;
        if (usdtNecesario > USDT_LIMITE) continue;
      }
      preciosValidos.push(precio);
      if (preciosValidos.length === 20) break;
    }

    if (!preciosValidos.length) return null;
    const promedio = preciosValidos.reduce((a, b) => a + b, 0) / preciosValidos.length;
    return parseFloat(promedio.toFixed(6));
  } catch (e) {
    console.error("❌ fetchPrecio:", e);
    return null;
  }
}

document.getElementById("btn-toggle-edicion").addEventListener("click", () => {
  modoEdicionActivo = !modoEdicionActivo;
  renderTarjetasPaises(modoEdicionActivo);
  mostrarAdvertenciaPendiente(false);
  const btn = document.getElementById("btn-toggle-edicion");
  btn.textContent = modoEdicionActivo ? "🔒 Finalizar Edición" : "✏️ Editar Precios";
});


document.getElementById("btn-refrescar").addEventListener("click", () => {
  document.getElementById("modal-confirmacion").classList.remove("hidden");
});

document.getElementById("btn-confirmar-binance").addEventListener("click", async () => {
  cerrarModalConfirmacion();

  for (const p of paises) {
    const fiat = p.fiat;
    const ajuste = parseFloat(document.querySelector(`input[data-fi="${fiat}"][data-tipo="ajuste"]`)?.value) || ajustesPorDefecto[fiat];
    if (!datosPaises[fiat]) datosPaises[fiat] = {};
    datosPaises[fiat].ajuste = ajuste;
    datosPaises[fiat].compra = null;
    datosPaises[fiat].venta = null;
  }

  renderTarjetasPaises(modoEdicionActivo);

  for (const p of paises) {
    const fiat = p.fiat;
    llamadasPendientes++;
    const compra = await fetchPrecio(fiat, "BUY");
    const venta = await fetchPrecio(fiat, "SELL");
    llamadasPendientes--;

    datosPaises[fiat].compra = compra;
    datosPaises[fiat].venta = venta;
    manejarFinDeLlamadas();
    renderTarjetasPaises(modoEdicionActivo);
  }

  escribirCruces();
});

function cerrarModalConfirmacion() {
  document.getElementById("modal-confirmacion").classList.add("hidden");
}

document.getElementById("btn-aplicar-ajustes").addEventListener("click", () => {
  for (const p of paises) {
    const fiat = p.fiat;

    const ajuste = parseFloat(document.querySelector(`input[data-fi="${fiat}"][data-tipo="ajuste"]`)?.value) || ajustesPorDefecto[fiat];
    const compra = parseFloat(document.querySelector(`input[data-fi="${fiat}"][data-tipo="compra"]`)?.value);
    const venta  = parseFloat(document.querySelector(`input[data-fi="${fiat}"][data-tipo="venta"]`)?.value);

    if (!datosPaises[fiat]) datosPaises[fiat] = {};

    datosPaises[fiat].ajuste = ajuste;
    if (!isNaN(compra)) datosPaises[fiat].compra = compra;
    if (!isNaN(venta))  datosPaises[fiat].venta  = venta;
  }

  renderTarjetasPaises(modoEdicionActivo);
  escribirCruces();
});


document.getElementById("btn-guardar-ajustes").addEventListener("click", async () => {
  for (const p of paises) {
    const fiat = p.fiat;

    const ajuste = parseFloat(document.querySelector(`input[data-fi="${fiat}"][data-tipo="ajuste"]`)?.value) || ajustesPorDefecto[fiat];
    const compra = parseFloat(document.querySelector(`input[data-fi="${fiat}"][data-tipo="compra"]`)?.value);
    const venta  = parseFloat(document.querySelector(`input[data-fi="${fiat}"][data-tipo="venta"]`)?.value);

    if (!datosPaises[fiat]) datosPaises[fiat] = {};

    datosPaises[fiat].ajuste = ajuste;
    if (!isNaN(compra)) datosPaises[fiat].compra = compra;
    if (!isNaN(venta))  datosPaises[fiat].venta  = venta;
  }

  await guardarSnapshot({ ...datosPaises, timestamp: new Date().toISOString() });
  snapshotPrevio = JSON.parse(JSON.stringify({ ...datosPaises, cruces: crucesAnteriores }));
  document.getElementById("ultima-actualizacion").textContent = `🕒 Última actualización: ${new Date().toLocaleString()}`;
  renderTarjetasPaises(modoEdicionActivo);
  escribirCruces();
  mostrarAdvertenciaPendiente(false);
});


 function escribirCruces() {
  const cont = document.getElementById("cruces-container");
  cont.innerHTML = "";
  cont.className = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 mt-10";

  Object.keys(datosPaises).forEach(origen => {
    Object.keys(datosPaises).forEach(destino => {
      if (origen === destino) return;

      const o = datosPaises[origen], d = datosPaises[destino];
      if (!o?.compra || !d?.venta) return;

      const ajuste = o.ajuste ?? ajustesPorDefecto[origen];
      datosPaises[origen].ajuste = ajuste;

      let tasaBase = destino === "VES" && origen === "COP"
        ? 1 / (d.venta / o.compra)
        : d.venta / o.compra;

      const tasaFinal = parseFloat((tasaBase * (
        (origen === "COP" && destino === "VES")
          ? (1 + ajuste / 100)
          : (1 - ajuste / 100)
      )).toFixed(6));

      const clave = `${origen}-${destino}`, ant = crucesAnteriores[clave];
      crucesAnteriores[clave] = tasaFinal;

      const color = claseCambio(tasaFinal, ant);
      const emoji = iconoCambio(tasaFinal, ant);
      const flagOrigen = paises.find(p => p.fiat === origen)?.emoji || "";
      const flagDestino = paises.find(p => p.fiat === destino)?.emoji || "";

      if (filtroPais) {
        if (rolVista === "origen" && origen !== filtroPais) return;
        if (rolVista === "destino" && destino !== filtroPais) return;
      }

      const card = document.createElement("div");
      card.className = `bg-white rounded-xl shadow-md p-4 border border-gray-200 transform transition-all duration-300 hover:scale-[1.015] ${color}`;

      card.innerHTML = `
        <h4 class="text-md font-bold mb-2">${flagOrigen} ${origen} → ${flagDestino} ${destino}</h4>
        <p class="text-gray-600 text-sm">Tasa base: ${formatearTasa(tasaBase)}</p>
        <p class="text-gray-600 text-sm">Ajuste aplicado: ${ajuste}%</p>
        <p class="text-lg font-semibold mt-2">Tasa final: ${formatearTasa(tasaFinal)} ${emoji}</p>
      `;

      cont.appendChild(card);
    });
  });
}


function openPopover() {
  const pop = document.getElementById("popover-paises"),
    btn = document.getElementById("btn-seleccionar-pais"),
    rect = btn.getBoundingClientRect();
  pop.style.top = `${rect.bottom + 4}px`;
  pop.style.left = `${rect.left}px`;
  pop.classList.remove("hidden");
}
function closePopover() {
  document.getElementById("popover-paises").classList.add("hidden");
}
function resetFiltros() {
  filtroPais = null; rolVista = "origen";
  document.getElementById("pais-seleccionado").innerText = "Todos";
  document.getElementById("tab-origen").className = "px-4 py-2 bg-white text-blue-600 font-semibold";
  document.getElementById("tab-destino").className = "px-4 py-2 bg-gray-100 text-gray-600";
  escribirCruces();
}

function initPopover() {
  const ul = document.getElementById("lista-paises");
  ul.innerHTML = "";
  paises.forEach(p => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = "w-full text-left p-3 hover:bg-blue-50";
    btn.innerText = `${p.nombre} (${p.fiat})`;
    btn.dataset.fi = p.fiat;
    btn.addEventListener("click", () => {
      filtroPais = p.fiat;
      document.getElementById("pais-seleccionado").innerText = p.nombre;
      closePopover();
      escribirCruces();
    });
    li.appendChild(btn);
    ul.appendChild(li);
  });

  document.addEventListener("click", e => {
    if (
      !document.getElementById("popover-paises").contains(e.target) &&
      !document.getElementById("btn-seleccionar-pais").contains(e.target)
    ) {
      closePopover();
    }
  });
}

document.getElementById("btn-seleccionar-pais").addEventListener("click", e => {
  e.stopPropagation(); openPopover();
});
document.getElementById("btn-resetear").addEventListener("click", resetFiltros);
document.getElementById("tab-origen").addEventListener("click", () => {
  rolVista = "origen";
  document.getElementById("tab-origen").className = "px-4 py-2 bg-white text-blue-600 font-semibold";
  document.getElementById("tab-destino").className = "px-4 py-2 bg-gray-100 text-gray-600";
  escribirCruces();
});
document.getElementById("tab-destino").addEventListener("click", () => {
  rolVista = "destino";
  document.getElementById("tab-destino").className = "px-4 py-2 bg-white text-blue-600 font-semibold";
  document.getElementById("tab-origen").className = "px-4 py-2 bg-gray-100 text-gray-600";
  escribirCruces();
});

(async () => {
  document.getElementById("loader").style.display = "block";
  await cargarSnapshot();
  renderTarjetasPaises(modoEdicionActivo);
  initPopover();
  for (const p of paises) {
    const sp = datosPaises[p.fiat] || {};
    if (sp.compra == null || sp.venta == null) {
      llamadasPendientes++;
      const compra = await fetchPrecio(p.fiat, "BUY");
      const venta = await fetchPrecio(p.fiat, "SELL");
      llamadasPendientes--;
      datosPaises[p.fiat] = { compra, venta, ajuste: sp.ajuste || ajustesPorDefecto[p.fiat] };
      manejarFinDeLlamadas();
    }
  }
  escribirCruces();
  document.getElementById("loader").style.display = "none";
  
})();

document.getElementById('btnLogout').onclick = () => {
  localStorage.removeItem('token');
  mostrarToast("🔒 Sesión cerrada");
  verificarSesion();
};


window.onload = () => {
  verificarSesion(); // Esto revisa si hay token y oculta o muestra secciones

  mainHeader.classList.add('hidden');
  document.getElementById('tasaWrap').classList.add('hidden');
  step1.classList.add('hidden');
  step2.classList.add('hidden');
  resultado.classList.add('hidden');
  step2Destino.classList.add('hidden');
  step1Origen.classList.remove('hidden');
  mostrarPaso1();
};


// Función para verificar si hay token guardado
function verificarSesion() {
  const token = localStorage.getItem('token');
  if (token) {
    loginSeccion.classList.add('hidden');
    contenidoPrivado.classList.remove('hidden');
  } else {
    loginSeccion.classList.remove('hidden');
    contenidoPrivado.classList.add('hidden');
  }
}

// Evento de login
btnLogin.onclick = async () => {
  const email = loginEmail.value.trim();
  const password = loginPass.value.trim();

  if (!email || !password) {
    mostrarToast("⚠️ Completa ambos campos");
    return;
  }

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      mostrarToast("❌ Usuario o clave incorrecta");
      return;
    }

    const data = await res.json();
    localStorage.setItem('token', data.token);
    mostrarToast("✅ Sesión iniciada");
    verificarSesion();

  } catch (err) {
    console.error(err);
    mostrarToast("❌ Error de conexión");
  }
};
