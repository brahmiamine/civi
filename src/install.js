// Captures the browser's install prompt so the app can offer "Installer l'application" itself.
let deferred = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

export const canInstall = () => !!deferred;

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function onInstallChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function promptInstall() {
  if (!deferred) return 'unavailable';
  deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  notify();
  return outcome;
}

// Step-by-step instructions when the browser does not offer an install prompt the app can trigger.
export function installHelp() {
  const ua = navigator.userAgent;
  if (isIOS()) return 'Touche le bouton Partager (carré avec une flèche vers le haut), puis « Sur l’écran d’accueil ». Civi s’ouvrira en plein écran et fonctionnera hors connexion.';
  if (/android/i.test(ua) && /firefox/i.test(ua)) return 'Ouvre le menu ⋮ de Firefox, puis touche « Installer » (ou « Ajouter à l’écran d’accueil »).';
  if (/samsungbrowser/i.test(ua)) return 'Ouvre le menu ☰, puis « Ajouter la page à » → « Écran d’accueil ».';
  if (/android/i.test(ua)) return 'Ouvre le menu ⋮ du navigateur, puis « Installer l’application » ou « Ajouter à l’écran d’accueil ».';
  if (/firefox/i.test(ua)) return 'Firefox pour ordinateur ne permet pas d’installer d’application web. Ouvre Civi dans Chrome, Edge ou Safari pour l’installer.';
  if (/safari/i.test(ua) && !/chrome|chromium|edg/i.test(ua)) return 'Dans Safari, ouvre le menu Fichier (ou Partager), puis « Ajouter au Dock ».';
  return 'Clique sur l’icône d’installation dans la barre d’adresse, ou ouvre le menu ⋮ du navigateur puis « Installer Civi ».';
}
