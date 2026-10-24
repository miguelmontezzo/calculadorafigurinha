// App instalável: registra o service worker e mostra o botão "Instalar app".
// Android / Chrome / Edge: usa o convite nativo de instalação.
// iPhone / iPad (Safari): não existe convite nativo, então o botão abre o passo a passo.

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

(() => {
  const instalado = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const btn = document.getElementById('installBtn');
  if (!btn || instalado) return;

  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let convite = null;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    convite = e;
    btn.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    btn.hidden = true;
    if (typeof toast === 'function') toast('App instalado! Procure o ícone na tela de início.');
  });

  if (ios) btn.hidden = false;

  btn.addEventListener('click', async () => {
    if (convite) {
      convite.prompt();
      await convite.userChoice.catch(() => {});
      convite = null;
      btn.hidden = true;
      return;
    }
    document.getElementById('installModal')?.classList.add('visible');
  });

  const modal = document.getElementById('installModal');
  modal?.addEventListener('click', e => {
    if (e.target === modal || e.target.closest('[data-fechar]')) modal.classList.remove('visible');
  });
})();
