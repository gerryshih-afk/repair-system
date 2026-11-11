(() => {
  'use strict';
  const button = document.querySelector('#install-button');
  const help = document.querySelector('#install-help');
  const status = document.querySelector('#connection-status');
  let installPrompt;
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  function updateConnection() {
    status.hidden = navigator.onLine;
    status.textContent = navigator.onLine ? '' : '目前離線：可開啟報修頁面；送出與讀取最新紀錄需要網路。輸入不會自動儲存。';
  }
  updateConnection();
  help.hidden = standalone();
  window.addEventListener('online', updateConnection);
  window.addEventListener('offline', updateConnection);
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    button.hidden = standalone();
  });
  button.addEventListener('click', async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    button.hidden = true;
    await prompt.prompt();
    await prompt.userChoice;
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    button.hidden = true;
    help.hidden = true;
  });
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        document.querySelector('#pwa-status').textContent = '離線功能未啟用，請在連線時重新整理頁面再試。';
      });
    });
  }
})();
