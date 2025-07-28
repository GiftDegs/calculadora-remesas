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

let mode = null;
let tasa = null;

async function cargarTasa() {
  try {
    const resp = await fetch('/api/tasa');
    const obj = await resp.json();
    tasa = parseFloat(obj.valor).toFixed(3);
    tasaValue.textContent = tasa;
    const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
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
  preguntaMonto.classList.remove('opacity-0', 'translate-y-4');
  preguntaMonto.classList.add('opacity-100', 'translate-y-0');
  step1.classList.add('hidden');
  step2.classList.remove('hidden');
  setTimeout(() => inputMonto.focus(), 300);
}

btnEnviar.onclick = () => cambiarPaso('enviar');
btnLlegar.onclick = () => cambiarPaso('llegar');

btnCalcular.onclick = () => {
  const rawValue = inputMonto.value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(rawValue)) {
    errorMonto.textContent = '⚠️ Ingresa un número válido con hasta 2 decimales';
    errorMonto.classList.remove('hidden');
    return;
  }
  errorMonto.classList.add('hidden');

  const monto = parseFloat(rawValue);
  const tasaF = parseFloat(tasa);
  const resultadoCalc = mode === 'enviar' ? Math.round(monto * tasaF) : Math.round(monto / tasaF);

  const fecha = tasaFechaEl.textContent;
  const montoFormat = monto.toLocaleString('es-AR');
  const resultFormat = resultadoCalc.toLocaleString('es-VE');
  const tasaFStr = tasaF.toLocaleString('es-ES');

  const mensaje = mode === 'enviar'
    ? `
      <div class="text-sm text-gray-500 dark:text-gray-400 italic">Enviando desde Argentina</div>
      <div class="text-3xl font-semibold text-blue-800 dark:text-blue-400">$${montoFormat} ARS</div>
      <div class="text-base text-gray-600 dark:text-gray-300 mt-1">recibirás</div>
      <div class="text-4xl font-extrabold text-blue-900 dark:text-blue-200">Bs. ${resultFormat}</div>
      <div class="text-sm text-gray-500 dark:text-gray-400 italic mt-4">
        Calculado con la tasa del día ${fecha} —
        <span class="text-blue-800 dark:text-blue-400 font-semibold">${tasaFStr}</span>
      </div>`
    : `
      <div class="text-sm text-gray-500 dark:text-gray-400 italic">Para recibir en Venezuela</div>
      <div class="text-3xl font-semibold text-blue-800 dark:text-blue-400">Bs. ${montoFormat}</div>
      <div class="text-base text-gray-600 dark:text-gray-300 mt-1">debes enviar</div>
      <div class="text-4xl font-extrabold text-blue-900 dark:text-blue-200">$${resultFormat} ARS</div>
      <div class="text-sm text-gray-500 dark:text-gray-400 italic mt-4">
        Calculado con la tasa del día ${fecha} —
        <span class="text-blue-800 dark:text-blue-400 font-semibold">${tasaFStr}</span>
      </div>`;

  document.getElementById('resText').innerHTML = mensaje;
  if (!soundSuccess.muted) soundSuccess.play();

  step2.classList.add('hidden');
  document.getElementById('tasaWrap').classList.add('transition', 'duration-500', 'ease-out', 'opacity-0', 'scale-95');
  setTimeout(() => document.getElementById('tasaWrap').classList.add('hidden'), 500);

  loader.classList.remove('hidden');
  setTimeout(() => {
    loader.classList.add('hidden');
    resultado.classList.remove('hidden');
    resultado.classList.add('fade-scale-in');
    document.getElementById('resText').classList.add('text-4xl');
  }, 1500);
};

btnRecalcular.onclick = () => {
  inputMonto.value = '';
  resultado.classList.add('hidden');
  resultado.classList.remove('fade-scale-in');
  document.getElementById('resText').classList.remove('text-4xl');
  step1.classList.remove('hidden');
  document.getElementById('tasaWrap').classList.remove('hidden');
  setTimeout(() => document.getElementById('tasaWrap').classList.remove('opacity-0', 'scale-95'), 50);
};

btnVolverPaso1.onclick = () => {
  inputMonto.value = '';
  step2.classList.add('hidden');
  step1.classList.remove('hidden');
  document.getElementById('tasaWrap').classList.remove('hidden');
  setTimeout(() => document.getElementById('tasaWrap').classList.remove('opacity-0', 'scale-95'), 50);
};

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

document.querySelectorAll('.ripple-button').forEach(btn => {
  btn.addEventListener('click', e => {
    const ripple = document.createElement('span');
    const diameter = Math.max(btn.clientWidth, btn.clientHeight);
    const radius = diameter / 2;
    ripple.style.width = ripple.style.height = `${diameter}px`;
    ripple.style.left = `${e.offsetX - radius}px`;
    ripple.style.top = `${e.offsetY - radius}px`;
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });
});

inputMonto.addEventListener('input', () => {
  let val = inputMonto.value.replace(/[^0-9.]/g, '');
  const parts = val.split('.');
  if (parts.length > 2) val = parts[0] + '.' + parts[1];
  if (parts[1]?.length > 2) val = parts[0] + '.' + parts[1].slice(0, 2);
  inputMonto.value = val;
});
inputMonto.addEventListener('focus', () => {
  setTimeout(() => inputMonto.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
});
inputMonto.addEventListener('keydown', e => {
  if (e.key === 'Enter') btnCalcular.click();
});

toggleDark.onclick = () => {
  document.documentElement.classList.toggle('dark');
};

btnCompartir.onclick = async () => {
  const container = document.getElementById('resTextContainer');

  html2canvas(container, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  }).then(canvas => {
    canvas.toBlob(async blob => {
      const file = new File([blob], 'byte-transfer-result.png', { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file], title: 'Mi cálculo en ByteTransfer' })) {
        try {
          await navigator.share({
            title: 'Mi cálculo en ByteTransfer',
            text: 'Este es el resultado de mi cálculo en ByteTransfer 💸',
            files: [file],
          });
        } catch (err) {
          console.warn('Compartir cancelado:', err);
        }
      } else {
        // Fallback si el navegador no soporta .share con archivos
        const link = document.createElement('a');
        link.download = 'byte-transfer-result.png';
        link.href = canvas.toDataURL();
        link.click();
      }
    }, 'image/png');
  });
};

