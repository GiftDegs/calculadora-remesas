// public/src/services/status.js
export async function obtenerStatus() {
  // Overrides de prueba desde el navegador
  // Forzar abierto:  localStorage.setItem('bt_force_open','1')
  // Forzar cerrado:  localStorage.setItem('bt_force_closed','1')
  // Modo: off | static | api  -> localStorage.setItem('bt_status_mode','off')
  const forceOpen   = localStorage.getItem('bt_force_open') === '1';
  const forceClosed = localStorage.getItem('bt_force_closed') === '1';
  if (forceOpen || forceClosed) {
    return {
      open: forceOpen && !forceClosed,
      message: forceOpen ? 'Apertura manual (test)' : 'Cierre manual (test)'
    };
  }

  const mode = localStorage.getItem('bt_status_mode') || 'off'; // 'off' | 'static' | 'api'

  if (mode === 'off') {
    // No consultar nada (evita 404)
    return { open: null, message: '' };
  }

  if (mode === 'static') {
    // Lee public/status.json
    try {
      const res = await fetch('/status.json?ts=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      const open = (typeof data?.open === 'boolean') ? data.open : null;
      return { open, message: data?.message || '' };
    } catch {
      return { open: null, message: '' };
    }
  }

  // mode === 'api' -> backend real
  try {
    const res = await fetch('/api/status?ts=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    const open = (typeof data?.open === 'boolean') ? data.open : null;
    return { open, message: data?.message || '' };
  } catch {
    return { open: null, message: '' };
  }
}

