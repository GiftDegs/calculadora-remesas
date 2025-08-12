export function mostrarToast(DOM, txt) {
  DOM.toastMensaje.textContent = txt;
  DOM.toastMensaje.classList.remove('hidden');
  DOM.toastMensaje.style.opacity = '1';
  DOM.toastMensaje.style.transform = 'scale(1)';
  setTimeout(() => {
    DOM.toastMensaje.style.opacity = '0';
    DOM.toastMensaje.style.transform = 'scale(0.95)';
    setTimeout(() => {
      DOM.toastMensaje.classList.add('hidden');
      DOM.toastMensaje.textContent = '';
    }, 300);
  }, 4500);
}
