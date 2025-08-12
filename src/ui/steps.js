import { DOM } from "./dom.js";
import { paisesDisponibles, CONFIG } from "../core/config.js";
import { formatearTasa, formatearFecha, redondearPorMoneda, userLocale } from "../core/utils.js";
import { calcularCruce } from "../core/fx.js";
import { obtenerTasa } from "../services/rates.js";
import { mostrarToast } from "./toasts.js";
import { showBanner, hideBanner, mostrarConfirmacionVerdeAutoOcultar } from "./banners.js";

let origenSeleccionado=null, destinoSeleccionado=null, mode=null, tasa=null, tasaCompraUSD=null, tasaDesactualizada=true;
let lastCalc=null;

function setModoButtonsEnabled(enabled){
  [DOM.btnEnviar, DOM.btnLlegar].forEach(b=>{
    b.disabled=!enabled;
    b.classList.toggle("opacity-50", !enabled);
    b.classList.toggle("cursor-not-allowed", !enabled);
    b.classList.toggle("hover:scale-105", enabled);
  });
}

function obtenerPais(cod){ return paisesDisponibles.find(p=>p.codigo===cod); }

function textosSegunPaises(){
  const o=obtenerPais(origenSeleccionado), d=obtenerPais(destinoSeleccionado);
  if(!o||!d) return {
    btnEnviar: "¿Cuánto dinero quieres enviar?",
    btnLlegar: "¿Cuánto quieres que llegue?",
    preguntaEnviar: "¿Cuánto vas a enviar?",
    preguntaLlegar: "¿Cuánto quieres que llegue?"
  };
  return {
    btnEnviar: `¿Cuántos ${o.moneda} quieres enviar?`,
    btnLlegar: `¿Cuántos ${d.moneda} quieres que lleguen?`,
    preguntaEnviar: `¿Cuántos ${o.moneda} vas a enviar?`,
    preguntaLlegar: `¿Cuántos ${d.moneda} quieres que lleguen?`
  };
}

function actualizarTextosUI(){
  const { btnEnviar: tEnviar, btnLlegar: tLlegar } = textosSegunPaises();
  DOM.btnEnviar.textContent=tEnviar; DOM.btnLlegar.textContent=tLlegar;
  const o=obtenerPais(origenSeleccionado), d=obtenerPais(destinoSeleccionado);
  if(o && d){ DOM.subtituloHeader.textContent=`De ${o.nombre} (${o.moneda}) a ${d.nombre} (${d.moneda})`; }
}

function setInputStyle({ state, msg=null }){
  DOM.inputMonto.classList.remove("border-blue-300","border-green-500","border-red-500","focus:ring-blue-300","focus:ring-green-500","focus:ring-red-500");
  if(msg!==null) DOM.ayudaMonto.textContent = msg;
  if(state==="neutral"){ DOM.inputMonto.classList.add("border-blue-300","focus:ring-blue-300"); }
  else if(state==="ok"){ DOM.inputMonto.classList.add("border-green-500","focus:ring-green-500"); }
  else if(state==="error"){ DOM.inputMonto.classList.add("border-red-500","focus:ring-red-500"); }
}

function maxPermitidoEnInput(){
  if(!mode || !tasaCompraUSD) return null;
  const maxPesosOrigen = CONFIG.MAX_USD * tasaCompraUSD;
  if(mode==="enviar") return maxPesosOrigen;
  if(!tasa || !Number.isFinite(parseFloat(tasa))) return null;
  return calcularCruce(origenSeleccionado,destinoSeleccionado,"enviar",maxPesosOrigen,parseFloat(tasa));
}

function rangoPermitidoEnInput(){
  if(!mode || !tasaCompraUSD) return null;
  const minPesosOrigen = CONFIG.MIN_USD * tasaCompraUSD;
  const maxPesosOrigen = CONFIG.MAX_USD * tasaCompraUSD;
  const convertir = (m)=> mode==="enviar" ? m : calcularCruce(origenSeleccionado,destinoSeleccionado,"enviar",m,parseFloat(tasa));
  const minInput = convertir(minPesosOrigen), maxInput=convertir(maxPesosOrigen);
  if(!Number.isFinite(minInput)||!Number.isFinite(maxInput)) return null;
  return { min:minInput, max:maxInput };
}

function updateAyudaRangos(){
  const o=obtenerPais(origenSeleccionado), d=obtenerPais(destinoSeleccionado);
  const codigoInput = mode==="llegar" ? (d?.codigo??"") : (o?.codigo??"");
  if(!mode){ DOM.ayudaMonto.textContent=""; return; }
  if(mode==="enviar" && !tasaCompraUSD){ DOM.ayudaMonto.textContent="Calculando límites..."; return; }
  if(mode==="llegar" && (!tasaCompraUSD || !tasa)){ DOM.ayudaMonto.textContent="Esperando tasa para calcular límites..."; return; }
  const rango=rangoPermitidoEnInput(); if(!rango){ DOM.ayudaMonto.textContent=""; return; }
  const nf=new Intl.NumberFormat(userLocale,{maximumFractionDigits:2});
  DOM.ayudaMonto.textContent = `Mínimo: ${nf.format(Math.max(0,rango.min))} ${codigoInput} • Máximo: ${nf.format(Math.max(rango.min,rango.max))} ${codigoInput}`;
}

function validarMontoEnVivo(){
  const raw=DOM.inputMonto.value.trim();
  updateAyudaRangos();
  if(!raw){ DOM.btnCalcular.disabled=true; setInputStyle({state:"neutral"}); return; }
  const num=parseFloat(raw);
  if(!Number.isFinite(num)||num<=0){ DOM.btnCalcular.disabled=true; setInputStyle({state:"error",msg:"Ingresa un número mayor que 0."}); return; }
  const t=Number(tasa);
  const listo = !!mode && Number.isFinite(tasaCompraUSD) && Number.isFinite(t) && t>0;
  if(!listo){ DOM.btnCalcular.disabled=true; setInputStyle({state:"neutral"}); return; }
  const montoEnPesos = mode==="enviar" ? num : calcularCruce(origenSeleccionado,destinoSeleccionado,mode,num,t);
  const usd = montoEnPesos / tasaCompraUSD;
  if(usd<CONFIG.MIN_USD){ DOM.btnCalcular.disabled=true; setInputStyle({state:"error",msg:`El mínimo equivalente es ${CONFIG.MIN_USD} USD (ahora llevas ~${usd.toFixed(2)} USD).`}); return; }
  if(usd>CONFIG.MAX_USD){ DOM.btnCalcular.disabled=true; setInputStyle({state:"error",msg:`El máximo equivalente es ${CONFIG.MAX_USD} USD (ahora llevas ~${usd.toFixed(2)} USD).`}); return; }
  if(usd>=300 && !DOM.ayudaMonto.textContent.includes("se envían en varias partes")){
    DOM.ayudaMonto.textContent = DOM.ayudaMonto.textContent ? `${DOM.ayudaMonto.textContent}\nℹ️ Montos mayores a 300 USD se envían en varias partes.` : `ℹ️ Montos mayores a 300 USD se envían en varias partes.`;
  }
  DOM.btnCalcular.disabled=false; setInputStyle({state:"ok"});
}

function resetearCampoMonto(){
  DOM.inputMonto.value=""; DOM.errorMonto.classList.add("hidden"); setInputStyle({state:"neutral"}); updateAyudaRangos();
}

function actualizarHeader(texto=""){ DOM.subtituloHeader.textContent=texto; DOM.mainHeader.classList.remove("hidden"); }

function ocultarTodo(){
  DOM.step1Origen.classList.add("hidden"); DOM.step2Destino.classList.add("hidden");
  DOM.step1.classList.add("hidden"); DOM.step2.classList.add("hidden");
  DOM.tasaWrap.classList.add("hidden"); DOM.resultado.classList.add("hidden");
}

export function mostrarPaso1(){
  ocultarTodo(); actualizarHeader("Selecciona el país de origen");
  DOM.btnVolverGlobal.classList.add("hidden"); DOM.step1Origen.classList.remove("hidden"); DOM.step1Origen.classList.add("fade-slide-in");
  DOM.origenBtns.innerHTML=""; paisesDisponibles.forEach(p=>{
    const btn=document.createElement("button");
    btn.textContent=`${p.emoji} ${p.nombre}`;
    btn.className="ripple-button bg-white dark:bg-gray-100 border border-[#0066FF] text-[#0066FF] font-semibold px-6 py-3 rounded-xl shadow transition hover:scale-105";
    btn.onclick=()=>{ origenSeleccionado=p.codigo; mostrarPaso2(); };
    DOM.origenBtns.appendChild(btn);
  });
}

function mostrarPaso2(){
  ocultarTodo(); actualizarHeader("Selecciona el país destino"); DOM.btnVolverGlobal.classList.remove("hidden");
  DOM.step2Destino.classList.remove("hidden"); DOM.step2Destino.classList.add("fade-slide-in");
  DOM.destinoBtns.innerHTML="";
  paisesDisponibles.filter(p=>p.codigo!==origenSeleccionado).forEach(p=>{
    const btn=document.createElement("button");
    btn.textContent=`${p.emoji} ${p.nombre}`;
    btn.className="ripple-button bg-white dark:bg-gray-100 border border-[#0066FF] text-[#0066FF] font-semibold px-6 py-3 rounded-xl shadow transition hover:scale-105";
    btn.onclick=()=>{ destinoSeleccionado=p.codigo; DOM.step2Destino.classList.add("hidden"); mostrarPaso3(); };
    DOM.destinoBtns.appendChild(btn);
  });
}

async function mostrarPaso3(){
  ocultarTodo(); DOM.step1.classList.remove("hidden"); DOM.btnVolverGlobal.classList.remove("hidden"); DOM.mainHeader.classList.remove("hidden"); DOM.tasaWrap.classList.remove("hidden");
  actualizarHeader("Selecciona el tipo de operación"); actualizarTextosUI();

  const { tasa: tasaCruda, compra, fecha } = await obtenerTasa(origenSeleccionado,destinoSeleccionado);
  const tNum=Number(tasaCruda); const tieneTasa = Number.isFinite(tNum) && tNum>0;
  if(Number.isFinite(compra)) tasaCompraUSD=compra;

  if(tieneTasa){
    tasa=tNum; DOM.tasaValue.textContent=formatearTasa(tasa); DOM.tasaFechaEl.textContent=formatearFecha(fecha);
    let dias=999; if(fecha){ const MS=86400000; dias=Math.floor((Date.now()-fecha)/MS); }
    if(dias>1){ tasaDesactualizada=true; hideBanner(DOM.tasaConfirmacion); DOM.tasaAdvertenciaTexto.textContent="🚨 Tasa desactualizada 🚨"; showBanner(DOM.tasaAdvertencia); }
    else{ tasaDesactualizada=false; hideBanner(DOM.tasaAdvertencia); DOM.tasaConfirmacionTexto.textContent="✅ Tasa actualizada"; mostrarConfirmacionVerdeAutoOcultar(DOM.tasaConfirmacion,4000); }
    setModoButtonsEnabled(!tasaDesactualizada); updateAyudaRangos(); validarMontoEnVivo();
    DOM.tasaValue.classList.add("animate-pulse"); setTimeout(()=>DOM.tasaValue.classList.remove("animate-pulse"),1000);
  }else{
    tasaDesactualizada=true; setModoButtonsEnabled(false); DOM.tasaValue.textContent="⚠️ No disponible"; DOM.tasaFechaEl.textContent="—";
    hideBanner(DOM.tasaConfirmacion); DOM.tasaAdvertenciaTexto.textContent="No hay tasa disponible"; showBanner(DOM.tasaAdvertencia);
    updateAyudaRangos(); validarMontoEnVivo();
  }
}

function cambiarPaso(tipo){
  if(tasaDesactualizada){
    mostrarToast(DOM,"⚠️ No podés continuar: la tasa está desactualizada. Actualizá y volvé a intentar.");
    DOM.tasaAdvertencia.classList.add("animate-bounce"); setTimeout(()=>DOM.tasaAdvertencia.classList.remove("animate-bounce"),800); return;
  }
  mode=tipo; const { preguntaEnviar, preguntaLlegar }=textosSegunPaises();
  DOM.preguntaMonto.textContent = tipo==="enviar"? preguntaEnviar : preguntaLlegar;
  resetearCampoMonto(); updateAyudaRangos();
  DOM.preguntaMonto.classList.remove("opacity-0","translate-y-4"); DOM.preguntaMonto.classList.add("opacity-100","translate-y-0");
  DOM.step1.classList.add("hidden"); DOM.step2.classList.remove("hidden"); setTimeout(()=>{ DOM.inputMonto.focus(); validarMontoEnVivo(); },300);
}

export function wireEvents(){
  // toggle dark
  (()=>{ const isDark=document.documentElement.classList.contains("dark"); DOM.btnToggleDark.textContent = isDark? "🌞 Claro" : "🌙 Oscuro"; })();
  DOM.btnToggleDark.addEventListener("click", ()=>{
    const isDark=document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark? "dark":"light");
    DOM.btnToggleDark.textContent = isDark? "🌞 Claro" : "🌙 Oscuro";
  });

  // botones
  DOM.btnEnviar.onclick=()=>cambiarPaso("enviar");
  DOM.btnLlegar.onclick=()=>cambiarPaso("llegar");

  DOM.btnVolverGlobal.onclick=()=>{
    // flujo simple hacia atrás
    if(!DOM.step2.classList.contains("hidden")){ // estás en monto
      DOM.resultado.classList.add("hidden"); DOM.step2.classList.add("hidden"); DOM.step1.classList.remove("hidden"); actualizarHeader("Selecciona el tipo de operación");
    }else if(!DOM.step1.classList.contains("hidden")){
      mostrarPaso2();
    }else{
      mostrarPaso1();
    }
  };

  // input
  let scrollPrev=0;
  DOM.inputMonto.addEventListener("focus",()=>{ scrollPrev=window.scrollY; setTimeout(()=>DOM.inputMonto.scrollIntoView({behavior:"smooth",block:"center"}),300); updateAyudaRangos(); });
  DOM.inputMonto.addEventListener("blur",()=>{ DOM.errorMonto.classList.add("hidden"); setTimeout(()=>window.scrollTo({top:scrollPrev,behavior:"smooth"}),150); });
  DOM.inputMonto.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); DOM.btnCalcular.click(); }});
  DOM.inputMonto.addEventListener("input",()=>{
    let val=DOM.inputMonto.value.replace(/,/g,".").replace(/[^0-9.]/g,"");
    const parts=val.split("."); if(parts.length>2) val=parts[0]+"."+parts[1]; if(parts[1]?.length>2) val=parts[0]+"."+parts[1].slice(0,2);
    DOM.inputMonto.value=val;
    const num=parseFloat(val), maxVal=maxPermitidoEnInput();
    if(Number.isFinite(num)&&Number.isFinite(maxVal)&&num>maxVal){ const capped=Math.floor(maxVal*100)/100; DOM.inputMonto.value=String(capped); }
    validarMontoEnVivo();
  });

  // calcular
  DOM.btnCalcular.onclick=()=>{
    const raw=DOM.inputMonto.value.trim(); const monto=parseFloat(raw); const t=parseFloat(tasa);
    if(isNaN(monto)){ DOM.errorMonto.textContent="⚠️ Ingresa un número válido"; DOM.errorMonto.classList.remove("hidden"); return; }
    if(isNaN(t)||t<=0){ DOM.errorMonto.textContent="⚠️ Tasa No Disponible."; DOM.errorMonto.classList.remove("hidden"); return; }
    if(!tasaCompraUSD){ DOM.errorMonto.textContent="⚠️ No se pudo obtener la tasa de compra en USD."; DOM.errorMonto.classList.remove("hidden"); return; }
    const montoEnPesos = mode==="enviar"? monto : calcularCruce(origenSeleccionado,destinoSeleccionado,mode,monto,t);
    const usd = montoEnPesos / tasaCompraUSD;
    if(usd<CONFIG.MIN_USD){ DOM.errorMonto.textContent=`⚠️ El monto mínimo permitido es equivalente a ${CONFIG.MIN_USD} USD`; DOM.errorMonto.classList.remove("hidden"); return; }
    if(usd>CONFIG.MAX_USD){ DOM.errorMonto.textContent=`⚠️ El monto máximo permitido es equivalente a ${CONFIG.MAX_USD} USD`; DOM.errorMonto.classList.remove("hidden"); return; }
    if(usd>=300){ mostrarToast(DOM,"ℹ️ Montos mayores a 300 USD se envían en varias partes."); }
    DOM.errorMonto.classList.add("hidden");

    const o=obtenerPais(origenSeleccionado), d=obtenerPais(destinoSeleccionado);
    const calc = Math.round(calcularCruce(origenSeleccionado,destinoSeleccionado,mode,monto,t));
    const calcRed = mode==="llegar"? redondearPorMoneda(calc,o.codigo) : calc;
    const fecha=DOM.tasaFechaEl.textContent; const montoFmt=new Intl.NumberFormat(userLocale,{maximumFractionDigits:2}).format(monto);
    const calcFmt=new Intl.NumberFormat(userLocale,{maximumFractionDigits:0}).format(calcRed); const tasaFmt=formatearTasa(tasa);

    lastCalc = { mode, origen:o, destino:d, montoIngresado:monto, montoCalculado:calcRed, tasa:t, fecha };
    const mensaje = mode==="enviar"
      ? `<div class="text-sm italic text-gray-500 dark:text-gray-400">Enviando desde ${o.nombre}</div>
         <div class="text-3xl font-semibold text-blue-800 dark:text-blue-400">$${montoFmt} ${o.codigo}</div>
         <div class="text-base text-gray-600 dark:text-gray-300 mt-1">recibirás</div>
         <div class="text-4xl font-extrabold text-blue-900 dark:text-blue-200">${d.codigo} ${calcFmt}</div>
         <div class="text-sm italic text-gray-500 dark:text-gray-400 mt-4">Calculado con la tasa del día ${fecha} — <span class="font-semibold text-blue-800 dark:text-blue-400">${tasaFmt}</span></div>`
      : `<div class="text-sm italic text-gray-500 dark:text-gray-400">Para recibir en ${d.nombre}</div>
         <div class="text-3xl font-semibold text-blue-800 dark:text-blue-400">${d.codigo} ${montoFmt}</div>
         <div class="text-base text-gray-600 dark:text-gray-300 mt-1">debes enviar</div>
         <div class="text-4xl font-extrabold text-blue-900 dark:text-blue-200">$${calcFmt} ${o.codigo}</div>
         <div class="text-sm italic text-gray-500 dark:text-gray-400 mt-4">Calculado con la tasa del día ${fecha} — <span class="font-semibold text-blue-800 dark:text-blue-400">${tasaFmt}</span></div>`;

    DOM.resText.innerHTML = mensaje;
    if(!DOM.soundSuccess.muted) DOM.soundSuccess.play();

    DOM.step2.classList.add("hidden");
    DOM.tasaWrap.classList.add("transition","duration-500","ease-out","opacity-0","scale-95");
    setTimeout(()=>DOM.tasaWrap.classList.add("hidden"),500);

    DOM.loader.classList.remove("hidden");
    setTimeout(()=>{ DOM.loader.classList.add("hidden"); DOM.resultado.classList.remove("hidden"); DOM.resultado.classList.add("fade-scale-in"); DOM.resText.classList.add("text-4xl"); },1500);
  };

  // recalcular
  DOM.btnRecalcular.onclick=()=>{
    resetearCampoMonto(); DOM.resText.classList.remove("text-4xl"); DOM.resultado.classList.add("hidden"); DOM.resultado.classList.remove("fade-scale-in");
    if(origenSeleccionado && destinoSeleccionado && mode){
      DOM.step1.classList.add("hidden"); DOM.step2.classList.remove("hidden"); DOM.tasaWrap.classList.remove("hidden"); actualizarHeader("Ingresa el monto");
      setTimeout(()=>{ DOM.inputMonto.focus(); validarMontoEnVivo(); DOM.tasaWrap.classList.remove("opacity-0","scale-95"); },200);
      return;
    }
    mostrarPaso1();
  };

  // iniciar flujo
  mostrarPaso1();
}

export function getLastCalc(){ return lastCalc; }
