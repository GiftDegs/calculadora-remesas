export function showBanner(el){ el.classList.remove("hidden","opacity-0","pointer-events-none","translate-y-1"); el.classList.add("opacity-100","translate-y-0"); }
export function hideBanner(el){ el.classList.add("opacity-0","pointer-events-none","translate-y-1"); el.classList.remove("opacity-100"); }
export function mostrarConfirmacionVerdeAutoOcultar(el,ms=4000){
  let t1,t2; clearTimeout(t1); clearTimeout(t2);
  el.classList.remove("hidden","confirm-out","confirm-in","confirm-blink"); void el.offsetWidth;
  el.classList.add("confirm-in","confirm-blink"); showBanner(el);
  t1=setTimeout(()=>{ el.classList.remove("confirm-blink","confirm-in"); el.classList.add("confirm-out");
    t2=setTimeout(()=>{ hideBanner(el); el.classList.remove("confirm-out"); },260);
  },ms);
}
