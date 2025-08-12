// src/main.js
import { DOM } from "./ui/dom.js";
import { initRipple } from "./ui/ripple.js";
import { initSharing } from "./ui/sharing.js";
import { wireEvents, mostrarPaso1, getLastCalc } from "./ui/steps.js";

window.onload = () => {
  // Efectos UI
  initRipple();

  // Compartir (usa el getter de cálculo)
  initSharing(DOM, getLastCalc);

  // Estado inicial de pantallas
  DOM.mainHeader.classList.add("hidden");
  DOM.tasaWrap.classList.add("hidden");
  DOM.step1.classList.add("hidden");
  DOM.step2.classList.add("hidden");
  DOM.resultado.classList.add("hidden");
  DOM.step2Destino.classList.add("hidden");
  DOM.step1Origen.classList.remove("hidden");

  // Eventos + arranque del flujo
  wireEvents();
  mostrarPaso1();
};
