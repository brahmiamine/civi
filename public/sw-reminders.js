// Reminder notifications, imported by the generated service worker (see vite.config.js).
// The page stores the reminder settings in the Cache API; this worker checks them when the page asks
// (every minute while the app is open or in the background) and on periodic background sync
// (installed app on Chromium browsers), so reminders can also arrive when the app is closed.
const STORE = 'civi-reminder';
const CONFIG = new URL('__civi-reminder', self.registration.scope).href;
const SENT = new URL('__civi-reminder-sent', self.registration.scope).href;
const ICON = new URL('pwa-192x192.png', self.registration.scope).href;

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const dayNum = (key) => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };

async function readJSON(url) {
  const res = await (await caches.open(STORE)).match(url);
  return res ? res.json() : null;
}
async function writeJSON(url, value) {
  await (await caches.open(STORE)).put(url, new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } }));
}

async function notify(title, body) {
  // When the app is on screen, show an in-app message instead of a system notification.
  const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const visible = wins.filter((c) => c.visibilityState === 'visible');
  if (visible.length) { visible.forEach((c) => c.postMessage({ type: 'civi-reminder', title, body })); return; }
  await self.registration.showNotification(title, { body, icon: ICON, badge: ICON, tag: 'civi-reminder', lang: 'fr', data: { url: self.registration.scope } });
}

async function check() {
  const cfg = await readJSON(CONFIG);
  if (!cfg || (!cfg.reminder && !cfg.streak)) return;
  if (self.Notification && self.Notification.permission !== 'granted') return;
  const now = new Date(), today = dayKey(now), mins = now.getHours() * 60 + now.getMinutes();
  const sent = (await readJSON(SENT)) || {};
  const done = (cfg.days && cfg.days[today]) || 0;
  const [h, m] = String(cfg.time || '19:00').split(':').map(Number);
  let changed = false;
  if (cfg.reminder && mins >= h * 60 + m && done < cfg.goal && sent.reminder !== today) {
    const left = cfg.goal - done;
    await notify('C’est l’heure de réviser', done ? 'Encore ' + left + ' question' + (left > 1 ? 's' : '') + ' pour atteindre ton objectif du jour (' + cfg.prep + ').' : 'Ton objectif du jour : ' + cfg.goal + ' questions (' + cfg.prep + '). Quelques minutes suffisent !');
    sent.reminder = today; changed = true;
  }
  const idle = cfg.lastActive ? dayNum(today) - dayNum(cfg.lastActive) : 0;
  if (cfg.streak && idle >= 2 && mins >= 9 * 60 && sent.streak !== today && sent.reminder !== today) {
    await notify('Ta préparation t’attend', 'Tu n’as pas révisé depuis ' + idle + ' jours. Une petite série de questions ? (' + cfg.prep + ')');
    sent.streak = today; changed = true;
  }
  if (changed) await writeJSON(SENT, sent);
}

self.addEventListener('periodicsync', (e) => { if (e.tag === 'civi-reminder') e.waitUntil(check()); });

self.addEventListener('message', (e) => {
  const type = e.data && e.data.type;
  if (type === 'civi-check') e.waitUntil(check());
  if (type === 'civi-test') e.waitUntil(self.registration.showNotification('Civi — notification de test', { body: e.data.body, icon: ICON, badge: ICON, tag: 'civi-test', lang: 'fr', data: { url: self.registration.scope } }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
    const win = wins.find((c) => c.url.startsWith(self.registration.scope));
    return win ? win.focus() : self.clients.openWindow(url);
  }));
});
