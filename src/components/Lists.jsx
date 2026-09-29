import { h2s, card, Segmented } from './ui.jsx';

export function Chips({ chips }) {
  return (
    <div className="chips" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 20px 0' }}>
      {chips.map((ch) => (
        <button key={ch.key} className="p-chip" onClick={ch.onClick} aria-pressed={ch.pressed} style={{ flex: 'none', height: 38, padding: '0 16px', borderRadius: 19, border: '1px solid ' + ch.border, background: ch.bg, color: ch.color, fontSize: 15, fontWeight: 500, cursor: 'pointer', transition: 'background .15s' }}>{ch.label}</button>
      ))}
    </div>
  );
}

export function Group({ g }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 16px' }}>
      {g.header && <h2 style={{ ...h2s, padding: '0 4px' }}>{g.header}</h2>}
      <div style={{ ...card, overflow: 'hidden' }}>
        {g.rows.map((r, i) => <Row key={i} r={r} />)}
      </div>
      {g.action && (
        <button className="p-outline" onClick={g.action.onClick} disabled={g.action.loading} style={{ height: 52, borderRadius: 10, border: '1.5px solid var(--primary)', background: 'transparent', color: 'var(--primaryText)', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer' }}>
          {g.action.loading && <span className="spinner sm" />}{g.action.label}
        </button>
      )}
    </div>
  );
}

export function Row({ r }) {
  const onKeyDown = r.onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); r.onClick(e); } } : undefined;
  return (
    <div className="p-row" onClick={r.onClick} onKeyDown={onKeyDown} role={r.role} tabIndex={r.tab} aria-checked={r.role === 'switch' ? r.checked : undefined} style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 58, padding: '10px 16px', borderBottom: r.sep, cursor: r.cursor, opacity: r.op, transition: 'background .12s' }}>
      {r.icon && <span style={{ width: 40, height: 40, flex: 'none', display: 'grid', placeItems: 'center', borderRadius: 8, background: r.iconBg, color: r.iconColor }}>{r.icon}</span>}
      {r.year && <span style={{ width: 58, flex: 'none', font: '600 28px/1 var(--font-heading)', color: 'var(--primaryText)' }}>{r.year}</span>}
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, padding: '3px 0' }}>
        {r.tag && <span style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: r.tag.bg, color: r.tag.color }}>{r.tag.label}</span>}
        <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.3, color: r.color, textWrap: 'pretty' }}>{r.title}</span>
        {r.sub && <span style={{ fontSize: 14, lineHeight: 1.35, color: 'var(--text2)' }}>{r.sub}</span>}
        {r.pct && <span style={{ height: 4, borderRadius: 2, background: 'var(--surface2)', overflow: 'hidden', marginTop: 5 }}><span style={{ display: 'block', height: '100%', width: r.pct, background: 'var(--primary)', borderRadius: 2 }} /></span>}
      </span>
      {r.value && <span style={{ flex: 'none', fontSize: 15, color: 'var(--text2)' }}>{r.value}</span>}
      {r.stat && <span style={{ flex: 'none', font: '600 22px/1 var(--font-heading)' }}>{r.stat}</span>}
      {r.badge && <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: r.badge.bg, color: r.badge.color }}>{r.badge.icon}{r.badge.label}</span>}
      {r.seg && <Segmented label="Thème" items={r.seg} />}
      {r.sw && <span aria-hidden="true" style={{ flex: 'none', width: 51, height: 31, borderRadius: 16, background: r.sw.track, padding: 2, transition: 'background .2s' }}><span style={{ display: 'block', width: 27, height: 27, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,.2)', transform: 'translateX(' + r.sw.x + ')', transition: 'transform .2s cubic-bezier(.3,.7,.3,1)' }} /></span>}
      {r.chev && <span style={{ flex: 'none', color: 'var(--text2)', opacity: 0.7 }}>{r.chev}</span>}
    </div>
  );
}

export function Empty({ e }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, padding: '56px 32px 24px' }}>
      <span style={{ width: 76, height: 76, borderRadius: '50%', display: 'grid', placeItems: 'center', background: e.iconBg, color: e.iconColor }}>{e.icon}</span>
      <div style={{ font: '600 23px/1.2 var(--font-heading)', marginTop: 4 }}>{e.title}</div>
      <div style={{ fontSize: 16, lineHeight: 1.45, color: 'var(--text2)', maxWidth: 270, textWrap: 'pretty' }}>{e.text}</div>
      {e.btn && <button className="p-empty" onClick={e.onBtn} style={{ marginTop: 12, height: 52, padding: '0 28px', borderRadius: 10, border: 'none', background: 'var(--btn)', color: 'var(--onBtn)', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>{e.btn}</button>}
    </div>
  );
}
