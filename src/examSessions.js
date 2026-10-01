export const CCI_BASE_URL = 'https://francais.cci-paris-idf.fr';

export function todayIso(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function departmentCode(postalCode = '') {
  const code = String(postalCode || '').trim();
  if (!/^\d{5}$/.test(code)) return '';
  if (code.startsWith('20')) return Number(code) < 20200 ? '2A' : '2B';
  return code.startsWith('97') || code.startsWith('98') ? code.slice(0, 3) : code.slice(0, 2);
}

export function centerRegistrationUrl(url = '') {
  if (!url) return CCI_BASE_URL + '/candidat';
  if (/^https?:\/\//i.test(url)) return url;
  return CCI_BASE_URL + (url.startsWith('/') ? url : '/' + url);
}

export function normalizeCenters(raw, now = new Date()) {
  if (!Array.isArray(raw)) return [];
  const today = todayIso(now);

  return raw
    .filter((center) => center && typeof center === 'object')
    .map((center) => {
      const sessions = Array.isArray(center.sessions) ? center.sessions : [];
      return {
        center_id: String(center.center_id || ''),
        center_name: String(center.center_name || '').trim() || 'Centre d’examen',
        product: String(center.product || ''),
        product_id: String(center.product_id || ''),
        address: String(center.address || '').trim(),
        postal_code: String(center.postal_code || '').trim(),
        url_centre: String(center.url_centre || ''),
        sessions: sessions
          .filter((session) => session && /^\d{4}-\d{2}-\d{2}$/.test(String(session.date || '')) && String(session.date) >= today)
          .map((session) => ({
            date: String(session.date),
            time: String(session.time || '').trim(),
            remaining_places: Number.isInteger(session.remaining_places) ? session.remaining_places : null,
            session_id: String(session.session_id || ''),
          }))
          .sort((a, b) => (a.date + ' ' + a.time).localeCompare(b.date + ' ' + b.time)),
      };
    })
    .filter((center) => center.sessions.length > 0);
}

export function flattenSessions(centers) {
  return centers
    .flatMap((center) => center.sessions.map((session) => ({ ...session, center })))
    .sort((a, b) => {
      const byDate = (a.date + ' ' + a.time).localeCompare(b.date + ' ' + b.time);
      return byDate || a.center.center_name.localeCompare(b.center.center_name, 'fr');
    });
}

export function formatSessionDate(date) {
  const parsed = new Date(date + 'T12:00:00');
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  }).format(parsed);
}
