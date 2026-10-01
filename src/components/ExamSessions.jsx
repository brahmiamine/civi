import { useEffect, useMemo, useState } from 'react';
import { ic } from '../Icon.jsx';
import { centerRegistrationUrl, departmentCode, flattenSessions, formatSessionDate, normalizeCenters } from '../examSessions.js';

const btn = {
  minHeight: 42, padding: '0 14px', border: 'none', borderRadius: 9,
  background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 14,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  textDecoration: 'none', cursor: 'pointer',
};

const btnSecondary = {
  ...btn,
  background: 'var(--surface)',
  color: 'var(--primaryText)',
  border: '1px solid var(--line)',
};

const inputStyle = {
  height: 46, border: '1px solid var(--line)', borderRadius: 10,
  padding: '0 10px', background: 'var(--surface)', color: 'var(--text)', font: 'inherit',
};

function mapsUrl(address) {
  return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(address);
}

function citymapperUrl(address) {
  return 'https://citymapper.com/directions?endaddress=' + encodeURIComponent(address);
}

function placeText(places) {
  if (places == null) return 'Places : voir le site CCI';
  if (places === 0) return 'Complet';
  return places + ' place' + (places > 1 ? 's' : '') + ' restante' + (places > 1 ? 's' : '');
}

function SessionLine({ center, session, compact = false }) {
  const places = session.remaining_places;
  return (
    <div style={{
      display: 'flex', flexDirection: compact ? 'row' : 'column', gap: compact ? 10 : 8,
      alignItems: compact ? 'center' : 'stretch', justifyContent: 'space-between',
      padding: compact ? '10px 0' : 0, borderTop: compact ? '1px solid var(--divider)' : 'none',
    }}>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <strong style={{ fontSize: compact ? 15 : 17 }}>
          {formatSessionDate(session.date)}{session.time ? ' · ' + session.time : ''}
        </strong>
        <span style={{ fontSize: 13, fontWeight: 600, color: places === 0 ? 'var(--red)' : 'var(--text2)' }}>
          {placeText(places)}
        </span>
      </div>
      <a href={centerRegistrationUrl(center.url_centre)} target="_blank" rel="noopener noreferrer" style={compact ? { ...btn, minHeight: 38, padding: '0 12px', fontSize: 13 } : btn}>
        Voir / s’inscrire
      </a>
    </div>
  );
}

export function ExamSessions() {
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dataReady, setDataReady] = useState(false);
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState('');
  const [date, setDate] = useState('');
  const [view, setView] = useState('center');
  const [openCenter, setOpenCenter] = useState('');
  const [limit, setLimit] = useState(30);

  useEffect(() => {
    let active = true;
    const url = import.meta.env.BASE_URL + 'data/cci_sessions.json';

    fetch(url, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        const normalized = normalizeCenters(data);
        setCenters(normalized);
        setDataReady(Array.isArray(data) && data.length > 0);
        setError('');
      })
      .catch(() => {
        if (!active) return;
        setError('Impossible de charger les disponibilités pour le moment.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  const sessions = useMemo(() => flattenSessions(centers), [centers]);
  const departments = useMemo(() => {
    const codes = new Set(centers.map((center) => departmentCode(center.postal_code)).filter(Boolean));
    return [...codes].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
  }, [centers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('fr');
    return sessions.filter(({ center, date: sessionDate }) => {
      if (dept && departmentCode(center.postal_code) !== dept) return false;
      if (date && sessionDate !== date) return false;
      if (!q) return true;
      return [center.center_name, center.address, center.postal_code]
        .some((value) => String(value || '').toLocaleLowerCase('fr').includes(q));
    });
  }, [sessions, query, dept, date]);

  const groupedCenters = useMemo(() => {
    const map = new Map();
    filtered.forEach(({ center, ...session }) => {
      const key = center.center_id || center.center_name;
      if (!map.has(key)) map.set(key, { key, center, sessions: [] });
      map.get(key).sessions.push(session);
    });
    return [...map.values()].sort((a, b) => {
      const da = a.sessions[0]?.date || '9999-12-31';
      const db = b.sessions[0]?.date || '9999-12-31';
      return da.localeCompare(db) || a.center.center_name.localeCompare(b.center.center_name, 'fr');
    });
  }, [filtered]);

  if (loading) {
    return (
      <div style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text2)' }}>
        <span className="spinner" /> Chargement des prochaines sessions…
      </div>
    );
  }

  const resetFilters = () => {
    setQuery('');
    setDept('');
    setDate('');
    setLimit(30);
  };

  return (
    <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h1 style={{ margin: 0, font: '600 28px/1.1 var(--font-heading)' }}>Trouver une session</h1>
        <p style={{ margin: 0, color: 'var(--text2)', fontSize: 15, lineHeight: 1.45 }}>
          Prochaines disponibilités pour l’examen civique « Carte de résident ».
        </p>
      </div>

      <div role="tablist" aria-label="Classement des sessions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: 4, borderRadius: 11, background: 'var(--surface)', border: '1px solid var(--line)' }}>
        {[
          ['center', 'Par centre'],
          ['date', 'Par date'],
        ].map(([id, label]) => {
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => { setView(id); setLimit(30); }}
              style={{
                minHeight: 40, border: 0, borderRadius: 8, cursor: 'pointer',
                background: active ? 'var(--tint)' : 'transparent',
                color: active ? 'var(--primaryText)' : 'var(--text2)',
                font: '600 14px/1 var(--font-body)',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 112px', gap: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, padding: '0 12px', height: 46, border: '1px solid var(--line)', borderRadius: 10, background: 'var(--surface)' }}>
          <span style={{ color: 'var(--text2)' }}>{ic('map', 18, 1.8)}</span>
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setLimit(30); }}
            placeholder="Ville, centre…"
            aria-label="Rechercher une ville ou un centre"
            style={{ minWidth: 0, width: '100%', border: 0, outline: 0, background: 'transparent', color: 'var(--text)', font: 'inherit' }}
          />
        </label>
        <select
          value={dept}
          onChange={(e) => { setDept(e.target.value); setLimit(30); }}
          aria-label="Filtrer par département"
          style={inputStyle}
        >
          <option value="">Tous</option>
          {departments.map((code) => <option key={code} value={code}>{code}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, padding: '0 12px', height: 46, border: '1px solid var(--line)', borderRadius: 10, background: 'var(--surface)' }}>
          <span style={{ color: 'var(--text2)' }}>{ic('calendar', 18, 1.8)}</span>
          <input
            type="date"
            value={date}
            onChange={(e) => { setDate(e.target.value); setLimit(30); }}
            aria-label="Filtrer par date"
            style={{ minWidth: 0, width: '100%', border: 0, outline: 0, background: 'transparent', color: 'var(--text)', font: 'inherit' }}
          />
        </label>
        {(query || dept || date) && (
          <button type="button" onClick={resetFilters} style={{ ...btnSecondary, minHeight: 46 }}>
            Effacer
          </button>
        )}
      </div>

      {error ? (
        <div role="alert" style={{ padding: 14, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--text2)', lineHeight: 1.4 }}>
          {error}
        </div>
      ) : !dataReady ? (
        <div style={{ padding: 18, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--text2)', textAlign: 'center', lineHeight: 1.45 }}>
          Les données de sessions ne sont pas encore disponibles sur ce déploiement.
          <div style={{ marginTop: 12 }}>
            <a href="https://francais.cci-paris-idf.fr/candidat" target="_blank" rel="noopener noreferrer" style={btn}>Consulter la CCI</a>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 18, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--text2)', textAlign: 'center' }}>
          Aucune session disponible avec ces filtres.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 14, color: 'var(--text2)' }}>
            {filtered.length} session{filtered.length > 1 ? 's' : ''} · {groupedCenters.length} centre{groupedCenters.length > 1 ? 's' : ''}
          </div>

          {view === 'center' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {groupedCenters.slice(0, limit).map(({ key, center, sessions: centerSessions }) => {
                const open = openCenter === key;
                return (
                  <article key={key} style={{ borderRadius: 12, background: 'var(--surface)', boxShadow: 'var(--shadowS)', overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => setOpenCenter(open ? '' : key)}
                      aria-expanded={open}
                      style={{ width: '100%', padding: 16, border: 0, background: 'transparent', color: 'inherit', textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start' }}
                    >
                      <span style={{ width: 42, height: 42, borderRadius: 9, flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--tint)', color: 'var(--primary)' }}>{ic('map', 21, 1.8)}</span>
                      <span style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <strong style={{ fontSize: 16 }}>{center.center_name}</strong>
                        {center.address && <span style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.35 }}>{center.address}</span>}
                        <span style={{ fontSize: 13, color: 'var(--primaryText)', fontWeight: 600 }}>
                          {centerSessions.length} session{centerSessions.length > 1 ? 's' : ''} · dès le {formatSessionDate(centerSessions[0].date)}
                        </span>
                      </span>
                      <span aria-hidden="true" style={{ color: 'var(--text2)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .18s ease', marginTop: 8 }}>
                        {ic('chevR', 20, 2)}
                      </span>
                    </button>

                    {open && (
                      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {center.address && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <a href={mapsUrl(center.address)} target="_blank" rel="noopener noreferrer" style={{ ...btnSecondary, minHeight: 40, fontSize: 13 }}>
                              Google Maps
                            </a>
                            <a href={citymapperUrl(center.address)} target="_blank" rel="noopener noreferrer" style={{ ...btnSecondary, minHeight: 40, fontSize: 13 }}>
                              Citymapper
                            </a>
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {centerSessions.map((session) => (
                            <SessionLine key={session.session_id + '/' + session.date} center={center} session={session} compact />
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.slice(0, limit).map(({ center, ...session }) => (
                <article key={center.center_id + '/' + session.session_id + '/' + session.date} style={{ padding: 16, borderRadius: 12, background: 'var(--surface)', boxShadow: 'var(--shadowS)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ width: 42, height: 42, borderRadius: 9, flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--tint)', color: 'var(--primary)' }}>{ic('calendar', 21, 1.8)}</span>
                    <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <strong style={{ fontSize: 17 }}>{formatSessionDate(session.date)}{session.time ? ' · ' + session.time : ''}</strong>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{center.center_name}</span>
                      {center.address && <span style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.35 }}>{center.address}</span>}
                    </div>
                  </div>
                  <SessionLine center={center} session={session} />
                  {center.address && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <a href={mapsUrl(center.address)} target="_blank" rel="noopener noreferrer" style={{ ...btnSecondary, minHeight: 38, fontSize: 13 }}>Google Maps</a>
                      <a href={citymapperUrl(center.address)} target="_blank" rel="noopener noreferrer" style={{ ...btnSecondary, minHeight: 38, fontSize: 13 }}>Citymapper</a>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          {limit < (view === 'center' ? groupedCenters.length : filtered.length) && (
            <button type="button" onClick={() => setLimit((n) => n + 30)} style={{ ...btnSecondary, alignSelf: 'center' }}>
              Afficher plus
            </button>
          )}
        </>
      )}

      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text2)', lineHeight: 1.4 }}>
        Source : CCI Paris Île-de-France. Les disponibilités peuvent évoluer ; vérifiez toujours la session sur le site CCI avant de finaliser votre inscription.
      </p>
    </div>
  );
}
