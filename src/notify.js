// Page side of the reminders: permission, settings shared with the service worker (public/sw-reminders.js).
const BASE = import.meta.env.BASE_URL;
const STORE = 'civi-reminder';
const configUrl = () => new URL(BASE + '__civi-reminder', location.origin).href;

export const notifSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'caches' in window;

export const notifPermission = () => (notifSupported() ? Notification.permission : 'unsupported');

export async function askPermission() {
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

async function registration() {
  try {
    return (await navigator.serviceWorker.getRegistration(BASE)) || null;
  } catch {
    return null;
  }
}

async function syncPeriodic(on) {
  const reg = await registration();
  if (!reg || !reg.periodicSync) return;
  try {
    if (!on) return await reg.periodicSync.unregister('civi-reminder');
    const perm = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (perm.state === 'granted') await reg.periodicSync.register('civi-reminder', { minInterval: 60 * 60 * 1000 });
  } catch {
    /* periodic background sync is optional (Chromium, installed app only) */
  }
}

export async function pushConfig(cfg) {
  if (!notifSupported()) return;
  try {
    const cache = await caches.open(STORE);
    await cache.put(configUrl(), new Response(JSON.stringify(cfg), { headers: { 'Content-Type': 'application/json' } }));
  } catch {
    return;
  }
  await syncPeriodic(cfg.reminder || cfg.streak);
}

// Asks the service worker to evaluate the reminders now.
export async function checkReminders() {
  const reg = await registration();
  reg?.active?.postMessage({ type: 'civi-check' });
}

export async function testNotification(body) {
  const reg = await registration();
  if (reg?.active) return reg.active.postMessage({ type: 'civi-test', body });
  try {
    new Notification('Civi — notification de test', { body });
  } catch {
    /* some mobile browsers only allow notifications from a service worker */
  }
}

export function onReminderMessage(fn) {
  if (!('serviceWorker' in navigator)) return () => {};
  const h = (e) => { if (e.data?.type === 'civi-reminder') fn(e.data); };
  navigator.serviceWorker.addEventListener('message', h);
  return () => navigator.serviceWorker.removeEventListener('message', h);
}
