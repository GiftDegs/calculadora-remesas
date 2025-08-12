export function initRipple() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('.ripple-button');
    if (!btn) return;
    const ripple = document.createElement('span');
    const d = Math.max(btn.clientWidth, btn.clientHeight);
    const r = d / 2;
    ripple.style.width = ripple.style.height = `${d}px`;
    const rect = btn.getBoundingClientRect();
    ripple.style.left = `${e.clientX - rect.left - r}px`;
    ripple.style.top = `${e.clientY - rect.top - r}px`;
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });
}
