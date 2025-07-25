const tasaValue = document.getElementById('tasaValue');
const tasaFecha = document.getElementById('tasaFecha');
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

let mode = null;
let tasa = null;

async function cargarTasa() {
  try {
    const resp = await fetch('/api/tasa');
    const obj = await resp.json();
    tasa = parseFloat(obj.valor).toFixed(3);
    tasaValue.textContent = tasa;

    const fecha = new Date();
    const fechaFormateada = fecha.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    tasaFecha.textContent = fechaFormateada;
  } catch {
    tasaValue.textContent = '⚠️ Error';
  }
}

btnEnviar.onclick = () => {
  mode = 'enviar';
  preguntaMonto.textContent = '¿Cuántos pesos argentinos vas a enviar?';
  preguntaMonto.classList.remove('opacity-0', 'translate-y-4');
  preguntaMonto.classList.add('opacity-100', 'translate-y-0');
  step1.classList.add('hidden');
  step2.classList.remove('hidden');
};

btnLlegar.onclick = () => {
  mode = 'llegar';
  preguntaMonto.textContent = '¿Cuántos bolívares quieres que lleguen?';
  preguntaMonto.classList.remove('opacity-0', 'translate-y-4');
  preguntaMonto.classList.add('opacity-100', 'translate-y-0');
  step1.classList.add('hidden');
  step2.classList.remove('hidden');
};

btnCalcular.onclick = () => {
  const monto = parseFloat(inputMonto.value);
  const tasaFloat = parseFloat(tasa);
  if (!monto || monto <= 0 || isNaN(monto)) {
    errorMonto.textContent = '⚠️ Ingresa un monto válido';
    errorMonto.classList.remove('hidden');
    return;
  } else {
    errorMonto.classList.add('hidden');
  }

  const resultadoCalc = mode === 'enviar'
    ? Math.round(monto * tasaFloat)
    : Math.round(monto / tasaFloat);

  const mensaje = mode === 'enviar'
    ? `<div>ARS: <span class="text-blue-700">${monto}</span></div><div>VES: <span class="text-purple-700">${resultadoCalc}</span></div>`
    : `<div>VES: <span class="text-purple-700">${monto}</span></div><div>ARS: <span class="text-blue-700">${resultadoCalc}</span></div>`;

  document.getElementById('resText').innerHTML = mensaje;
  soundSuccess.play();
  step2.classList.add('hidden');
  resultado.classList.remove('hidden');
};

btnRecalcular.onclick = () => {
  inputMonto.value = '';
  resultado.classList.add('hidden');
  step1.classList.remove('hidden');
};

btnWhats.onclick = () => {
  const txt = `Tasa ARS→VES: ${tasa}\n` + document.getElementById('resText').innerText;
  window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank');
};

btnVolverPaso1.onclick = () => {
  step2.classList.add('hidden');
  step1.classList.remove('hidden');
  inputMonto.value = '';
  errorMonto.classList.add('hidden');
};

window.onload = cargarTasa;

document.querySelectorAll('.ripple-button').forEach(btn => {
  btn.addEventListener('click', function (e) {
    const ripple = document.createElement('span');
    const diameter = Math.max(this.clientWidth, this.clientHeight);
    const radius = diameter / 2;
    ripple.style.width = ripple.style.height = `${diameter}px`;
    ripple.style.left = `${e.offsetX - radius}px`;
    ripple.style.top = `${e.offsetY - radius}px`;
    ripple.style.position = 'absolute';
    ripple.style.borderRadius = '50%';
    ripple.style.background = 'rgba(255,255,255,0.4)';
    ripple.style.animation = 'ripple 0.6s linear';
    ripple.style.pointerEvents = 'none';
    this.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });
});
