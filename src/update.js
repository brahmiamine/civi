// New versions of the app (service worker) are installed without interrupting the learner:
// the page only reloads once no test, form or sheet is on screen (see setUpdateGuard in App.jsx).
import { registerSW } from 'virtual:pwa-register';

let waiting = false, busy = () => false, update = null;

export function initUpdates() {
  update = registerSW({
    immediate: true,
    onNeedRefresh() { waiting = true; applyUpdate(); },
  });
}

export function setUpdateGuard(fn) { busy = fn || (() => false); }

export function applyUpdate() {
  if (!waiting || !update || busy()) return;
  waiting = false;
  update(true);
}
