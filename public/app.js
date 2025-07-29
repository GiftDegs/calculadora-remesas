// Detectar la configuración regional del usuario
const userLocale = navigator.language || 'es-ES';

// Variables
const tasaCard = document.getElementById('tasaCard');
const tasaTitulo = document.getElementById('tasaTitulo');
const tasaFechaEl = document.getElementById('tasaFecha');
const tasaValue = document.getElementById('tasaValue');
const tasaConfirm = document.getElementById('tasaConfirmacion');
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const resultado = document.getElementById('resultado');
const btnEnviar = document.getElementById('btnEnviar');
const btnLlegar = document.getElementById('btnLlegar');
const btnCalcular = document.getElementById('btnCalcular');
const btnRecalcular = document.getElementById('btnRecalcular');
const btnWhats = document.getElementById('btnWhats');
const btnVolverPaso1 = document.getElementById('btnVolverPaso1');
const inputMonto = document.getElementById('inputMonto');
const preguntaMonto = document.getElementById('preguntaMonto');
const errorMonto = document.getElementById('errorMonto');
const soundSuccess = document.getElementById('soundSuccess');
const toggleDark = document.getElementById('toggleDark');
const loader = document.getElementById('calculando');
const btnUpdate = document.getElementById('btnUpdate');
const btnCompartir = document.getElementById('btnCompartir');
const resTextContainer = document.getElementById('resTextContainer');
const resText = document.getElementById('resText');

let mode = null;
let tasa = null;

async function cargarTasa() {
  try {
    const resp = await fetch('/api/tasa');
    const obj = await resp.json();
    tasa = parseFloat(obj.valor).toFixed(3);
    tasaValue.textContent = tasa;

    const fecha = new Date().toLocaleDateString(userLocale, {
      day: '2-digit', month: 'long', year: 'numeric'
    });
    tasaFechaEl.textContent = fecha;

    tasaConfirm.classList.remove('hidden');
    setTimeout(() => tasaConfirm.classList.add('hidden'), 3000);
    tasaValue.classList.add('animate-pulse');
    setTimeout(() => tasaValue.classList.remove('animate-pulse'), 1000);
  } catch {
    tasaValue.textContent = '⚠️ Error';
  }
}

window.onload = cargarTasa;
btnUpdate.onclick = cargarTasa;

function cambiarPaso(tipo) {
  mode = tipo;
  preguntaMonto.textContent = tipo === 'enviar'
    ? '¿Cuántos pesos argentinos vas a enviar?'
    : '¿Cuántos bolívares quieres que lleguen?';
  preguntaMonto.classList.remove('opacity-0','translate-y-4');
  preguntaMonto.classList.add('opacity-100','translate-y-0');
  step1.classList.add('hidden');
  step2.classList.remove('hidden');
  setTimeout(() => inputMonto.focus(), 300);
}

btnEnviar.onclick = () => cambiarPaso('enviar');
btnLlegar.onclick = () => cambiarPaso('llegar');

function redondearCentena(valor) {
  const resto = valor % 100;
  return resto >= 50 ? valor + (100 - resto) : valor - resto;
}

btnCalcular.onclick = () => {
  const raw = inputMonto.value.trim();
  const monto = parseFloat(raw);
  const tasaF = parseFloat(tasa);

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

  const montoEnPesos = mode === 'enviar' ? monto : monto / tasaF;

  if (montoEnPesos < 1000) {
    errorMonto.textContent = '⚠️ El monto mínimo permitido es equivalente a $1.000 ARS';
    errorMonto.classList.remove('hidden');
    return;
  }

  if (montoEnPesos > 1000000) {
    errorMonto.textContent = '⚠️ El monto máximo permitido es equivalente a $1.000.000 ARS';
    errorMonto.classList.remove('hidden');
    return;
  }

  errorMonto.classList.add('hidden');

  const calc = mode === 'enviar'
    ? Math.round(monto * tasaF)
    : Math.round(monto / tasaF);

  const calcRedondeado = mode === 'llegar'
    ? redondearCentena(calc)
    : calc;

  const fecha = tasaFechaEl.textContent;
  const montoFmt = new Intl.NumberFormat(userLocale, { maximumFractionDigits: 2 }).format(monto);
  const calcFmt = new Intl.NumberFormat(userLocale, { maximumFractionDigits: 0 }).format(calcRedondeado);
  const tasaFmt = new Intl.NumberFormat(userLocale, { maximumFractionDigits: 3 }).format(tasaF);

  const mensaje = mode === 'enviar'
    ? `<div class="text-sm italic text-gray-500 dark:text-gray-400">Enviando desde Argentina</div>
       <div class="text-3xl font-semibold text-blue-800 dark:text-blue-400">$${montoFmt} ARS</div>
       <div class="text-base text-gray-600 dark:text-gray-300 mt-1">recibirás</div>
       <div class="text-4xl font-extrabold text-blue-900 dark:text-blue-200">Bs. ${calcFmt}</div>
       <div class="text-sm italic text-gray-500 dark:text-gray-400 mt-4">
         Calculado con la tasa del día ${fecha} — 
         <span class="font-semibold text-blue-800 dark:text-blue-400">${tasaFmt}</span>
       </div>`
    : `<div class="text-sm italic text-gray-500 dark:text-gray-400">Para recibir en Venezuela</div>
       <div class="text-3xl font-semibold text-blue-800 dark:text-blue-400">Bs. ${montoFmt}</div>
       <div class="text-base text-gray-600 dark:text-gray-300 mt-1">debes enviar</div>
       <div class="text-4xl font-extrabold text-blue-900 dark:text-blue-200">$${calcFmt} ARS</div>
       <div class="text-sm italic text-gray-500 dark:text-gray-400 mt-4">
         Calculado con la tasa del día ${fecha} — 
         <span class="font-semibold text-blue-800 dark:text-blue-400">${tasaFmt}</span>
       </div>`;

  resText.innerHTML = mensaje;

  if (!soundSuccess.muted) soundSuccess.play();

  step2.classList.add('hidden');
  document.getElementById('tasaWrap').classList.add('transition','duration-500','ease-out','opacity-0','scale-95');
  setTimeout(() => document.getElementById('tasaWrap').classList.add('hidden'), 500);

  loader.classList.remove('hidden');
  setTimeout(() => {
    loader.classList.add('hidden');
    resultado.classList.remove('hidden');
    resultado.classList.add('fade-scale-in');
    resText.classList.add('text-4xl');
  }, 1500);
};

// Botón recalcular
btnRecalcular.onclick = () => {
  inputMonto.value = '';
  resText.classList.remove('text-4xl');
  resultado.classList.add('hidden');
  resultado.classList.remove('fade-scale-in');
  step1.classList.remove('hidden');
  document.getElementById('tasaWrap').classList.remove('hidden');
  setTimeout(() => document.getElementById('tasaWrap').classList.remove('opacity-0','scale-95'), 50);
};

// Botón volver
btnVolverPaso1.onclick = () => {
  inputMonto.value = '';
  step2.classList.add('hidden');
  step1.classList.remove('hidden');
  document.getElementById('tasaWrap').classList.remove('hidden');
  setTimeout(() => document.getElementById('tasaWrap').classList.remove('opacity-0','scale-95'), 50);
};

// Botón WhatsApp
btnWhats.onclick = () => {
  const fecha = tasaFechaEl.textContent;
  const tasaFmt = parseFloat(tasa).toLocaleString('es-ES');
  const numero = '5491157261053';

  const rawValue = parseFloat(inputMonto.value.trim());
  const montoIngresado = isNaN(rawValue) ? 0 : rawValue;
  const montoCalculado = mode === 'enviar'
    ? Math.round(montoIngresado * parseFloat(tasa))
    : Math.round(montoIngresado / parseFloat(tasa));

  const ingresadoFmt = montoIngresado.toLocaleString('es-AR');
  const calculadoFmt = montoCalculado.toLocaleString('es-VE');

  const txt = mode === 'enviar'
    ? `Hola, voy a enviar $${ingresadoFmt} ARS para que se reciban Bs. ${calculadoFmt} en Venezuela. Tasa del día ${fecha}: ${tasaFmt}`
    : `Hola, quiero que lleguen Bs. ${ingresadoFmt} en Venezuela, por eso voy a enviar $${calculadoFmt} ARS. Tasa del día ${fecha}: ${tasaFmt}`;

  window.open(`https://wa.me/${numero}?text=${encodeURIComponent(txt)}`, '_blank');
};


// Ripple
document.querySelectorAll('.ripple-button').forEach(btn => {
  btn.addEventListener('click', e => {
    const ripple = document.createElement('span');
    const d = Math.max(btn.clientWidth, btn.clientHeight);
    const r = d / 2;
    ripple.style.width = ripple.style.height = `${d}px`;
    ripple.style.left = `${e.offsetX - r}px`;
    ripple.style.top = `${e.offsetY - r}px`;
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });
});

// Input validation
let scrollAntesDeTeclado = 0;

inputMonto.addEventListener('input', () => {
  let val = inputMonto.value.replace(/[^0-9.]/g, '');
  const parts = val.split('.');
  if (parts.length > 2) val = parts[0] + '.' + parts[1];
  if (parts[1]?.length > 2) val = parts[0] + '.' + parts[1].slice(0,2);
  inputMonto.value = val;
});

inputMonto.addEventListener('focus', () => {
  scrollAntesDeTeclado = window.scrollY;
  setTimeout(() => inputMonto.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
});

inputMonto.addEventListener('blur', () => {
  setTimeout(() => window.scrollTo({ top: scrollAntesDeTeclado, behavior: 'smooth' }), 150);
});

inputMonto.addEventListener('keydown', e => {
  if (e.key === 'Enter') btnCalcular.click();
});


// Toggle dark mode
toggleDark.onclick = () => document.documentElement.classList.toggle('dark');

// Botón compartir imagen
const menuCompartir = document.getElementById('menuCompartir');
const opcionImagen = document.getElementById('opcionImagen');
const opcionTexto = document.getElementById('opcionTexto');

btnCompartir.onclick = (e) => {
  e.stopPropagation(); // prevenir cierre inmediato
  menuCompartir.classList.remove('hidden');
};

// Cerrar si clickea fuera
document.addEventListener('click', (e) => {
  if (!menuCompartir.contains(e.target) && e.target !== btnCompartir) {
    menuCompartir.classList.add('hidden');
  }
});

// Compartir imagen
opcionImagen.onclick = async () => {
  menuCompartir.classList.add('hidden');
  const canvas = await html2canvas(resTextContainer, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  const file = new File([blob], 'byte-transfer-result.png', { type: 'image/png' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: 'ByteTransfer',
        text: 'Resultado de cambio enviado desde la app ByteTransfer',
        files: [file],
      });
    } catch (err) {
      console.warn('Share cancelado o falló:', err);
    }
  } else {
    // fallback
    const link = document.createElement('a');
    link.download = 'byte-transfer-result.png';
    link.href = canvas.toDataURL();
    link.click();
  }
};


// Previsualización flotante (toast)
const toastMensaje = document.getElementById('toastMensaje');

function mostrarToast(texto) {
  toastMensaje.textContent = texto;
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

// Función de copiar texto al hacer clic en “💬 Compartir texto”
opcionTexto.onclick = async () => {
  menuCompartir.classList.add('hidden');

  const fecha = tasaFechaEl.textContent;
  const tasaF = parseFloat(tasa);

  const rawValue = parseFloat(inputMonto.value.trim());
  const montoIngresado = isNaN(rawValue) ? 0 : rawValue;
  let montoCalculado = mode === 'enviar'
    ? Math.round(montoIngresado * tasaF)
    : Math.round(montoIngresado / tasaF);

  // ✅ Redondear ARS si modo es "llegar"
  if (mode === 'llegar') {
    const resto = montoCalculado % 100;
    montoCalculado = resto >= 50
      ? montoCalculado + (100 - resto)
      : montoCalculado - resto;
  }

  const ingresadoFmt = montoIngresado.toLocaleString('es-AR');
  const calculadoFmt = montoCalculado.toLocaleString('es-VE');

  const tasaFmt = tasaF.toLocaleString('es-ES');
  const mensajePro = `📦 Transferencia calculada con ByteTransfer\n\n` +
    (mode === 'enviar'
      ? `💰 Monto a enviar: $${ingresadoFmt} ARS\n📥 Monto a recibir: Bs. ${calculadoFmt}`
      : `📥 Monto a recibir: Bs. ${ingresadoFmt}\n💰 Monto a enviar: $${calculadoFmt} ARS`) +
    `\n💱 Tasa del día: ${tasaFmt}\n📅 Fecha: ${fecha}`;

  try {
    await navigator.clipboard.writeText(mensajePro);
    mostrarToast(mensajePro); // visualiza la tarjetita
  } catch (err) {
    mostrarToast('⚠️ Error al copiar');
    console.error(err);
  }
};
