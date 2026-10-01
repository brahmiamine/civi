import { useEffect, useMemo, useState } from 'react';
import { ic } from '../Icon.jsx';
import { centerRegistrationUrl, departmentCode, flattenSessions, formatSessionDate, normalizeCenters } from '../examSessions.js';

const btn = {
  minHeight: 42, padding: '0 14px', border: 'none', borderRadius: 9,
  background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 14,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  textDecoration: 'none', cursor: 'pointer',
};

export function ExamSessions() {
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dataReady, setDataReady] = useState(false);
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState('');
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
    return sessions.filter(({ center }) => {
      if (dept && departmentCode(center.postal_code) !== dept) return false;
      if (!q) return true;
      return [center.center_name, center.address, center.postal_code]
        .some((value) => String(value || '').toLocaleLowerCase('fr').includes(q));
    });
  }, [sessions, query, dept]);

  if (loading) {
    return (
      <div style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text2)' }}>
        <span className="spinner" /> Chargement des prochaines sessions…
      </div>
    );
  }

  return (
    <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h1 style={{ margin: 0, font: '600 28px/1.1 var(--font-heading)' }}>Trouver une session</h1>
        <p style={{ margin: 0, color: 'var(--text2)', fontSize: 15, lineHeight: 1.45 }}>
          Prochaines disponibilités pour l’examen civique « Carte de résident », classées par date.
        </p>
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
          style={{ height: 46, border: '1px solid var(--line)', borderRadius: 10, padding: '0 10px', background: 'var(--surface)', color: 'var(--text)', font: 'inherit' }}
        >
          <option value="">Tous</option>
          {departments.map((code) => <option key={code} value={code}>{code}</option>)}
        </select>
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
            {filtered.length} session{filtered.length > 1 ? 's' : ''} disponible{filtered.length > 1 ? 's' : ''}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.slice(0, limit).map(({ center, ...session }) => {
              const places = session.remaining_places;
              const placeText = places == null ? 'Places : voir le site CCI'
                : places === 0 ? 'Complet'
                  : places + ' place' + (places > 1 ? 's' : '') + ' restante' + (places > 1 ? 's' : '');
              return (
                <article key={center.center_id + '/' + session.session_id + '/' + session.date} style={{ padding: 16, borderRadius: 12, background: 'var(--surface)', boxShadow: 'var(--shadowS)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ width: 42, height: 42, borderRadius: 9, flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--tint)', color: 'var(--primary)' }}>{ic('calendar', 21, 1.8)}</span>
                    <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <strong style={{ fontSize: 17 }}>{formatSessionDate(session.date)}{session.time ? ' · ' + session.time : ''}</strong>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{center.center_name}</span>
                      {center.address && <span style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.35 }}>{center.address}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: places === 0 ? 'var(--red)' : 'var(--text2)' }}>{placeText}</span>
                    <a href={centerRegistrationUrl(center.url_centre)} target="_blank" rel="noopener noreferrer" style={btn}>
                      Voir / s’inscrire
                    </a>
                  </div>
                </article>
              );
            })}
          </div>

          {limit < filtered.length && (
            <button type="button" onClick={() => setLimit((n) => n + 30)} style={{ ...btn, alignSelf: 'center', background: 'var(--surface)', color: 'var(--primaryText)', border: '1px solid var(--line)' }}>
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
