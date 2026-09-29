import { btnPrimary, iconBtn, field, ImagePicker } from './ui.jsx';

export function TopBar({ bar }) {
  return (
    <div style={{ flex: 'none', height: 52, display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px 0 4px' }}>
      <button className="p-bg2" onClick={bar.onBack} aria-label={bar.backLabel} style={{ ...iconBtn, color: 'var(--text)' }}>{bar.backIcon}</button>
      <div style={{ flex: 1, minWidth: 0, font: '600 21px/1.2 var(--font-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bar.title}</div>
      {bar.star && <button className="p-star" onClick={bar.star.onClick} aria-label={bar.star.label} aria-pressed={bar.star.pressed} style={{ ...iconBtn, color: bar.star.color, transition: 'transform .15s' }}>{bar.star.icon}</button>}
    </div>
  );
}

export function QuizBar({ b }) {
  return (
    <div style={{ flex: 'none', padding: '0 20px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div role="progressbar" aria-label="Progression du test" style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: b.pct, background: 'var(--primary)', borderRadius: 2, transition: 'width .35s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 22, fontSize: 14, color: 'var(--text2)' }}>
        <span>{b.mode}</span>
        {b.timer && <span aria-label="Temps restant" style={{ display: 'flex', alignItems: 'center', gap: 6, font: '600 18px/1 var(--font-heading)', color: b.timerColor, fontVariantNumeric: 'tabular-nums' }}>{b.clock}{b.timer}</span>}
      </div>
    </div>
  );
}

export function Sticky({ s }) {
  return (
    <div style={{ flex: 'none', padding: '12px 16px 10px', background: 'var(--bg)', borderTop: '1px solid var(--divider)', display: 'flex', flexDirection: s.dir, gap: 8 }}>
      <button className="p-btn" onClick={s.onClick} disabled={s.disabled} aria-busy={s.loading ? 'true' : undefined} style={{ ...btnPrimary, order: 1, flex: 1, minHeight: 54, opacity: s.op }}>{s.loading && <span className="spinner" />}{s.icon}{s.label}</button>
      {s.secondary && <button className="p-secondary" onClick={s.secondary.onClick} style={{ order: s.secondary.order, flex: 1, minHeight: s.secondary.h, borderRadius: 10, border: s.secondary.border, background: 'transparent', color: s.secondary.color, font: '600 16px/1 var(--font-body)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}>{s.secondary.icon}{s.secondary.label}</button>}
    </div>
  );
}

export function Nav({ tabs }) {
  return (
    <nav aria-label="Navigation principale" style={{ flex: 'none', display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', background: 'var(--surface)', borderTop: '1px solid var(--divider)', padding: '6px 4px 0' }}>
      {tabs.map((t) => (
        <button key={t.id} className="p-tab" onClick={t.onClick} aria-label={t.label} aria-current={t.current} style={{ height: 58, border: 'none', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: t.color, cursor: 'pointer', transition: 'transform .1s' }}>
          <span style={{ width: 56, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', background: t.pill, transition: 'background .2s' }}>{t.icon}</span>
          <span style={{ fontSize: 12, fontWeight: t.weight }}>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function Sheet({ sheet, onClose, onDown, onMove, onUp }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', opacity: sheet.scrimOp, transition: 'opacity .2s', animation: 'tcFade .2s' }} />
      <div role="dialog" aria-modal="true" aria-label={sheet.title} style={{ position: 'relative', background: 'var(--sheet)', borderRadius: '16px 16px 0 0', paddingBottom: 'calc(14px + max(24px, var(--safe-bottom)))', transform: sheet.transform, transition: sheet.transition, animation: 'tcUp .28s cubic-bezier(.2,.8,.2,1)', maxHeight: '86%', display: 'flex', flexDirection: 'column' }}>
        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} style={{ touchAction: 'none', cursor: 'grab', padding: '10px 20px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, background: 'var(--line)', marginBottom: 12 }} />
          <div style={{ font: '600 25px/1.15 var(--font-heading)' }}>{sheet.title}</div>
          {sheet.sub && <div style={{ fontSize: 16, lineHeight: 1.45, color: 'var(--text2)', textWrap: 'pretty' }}>{sheet.sub}</div>}
        </div>
        {sheet.options && (
          <div style={{ padding: '8px 12px 0', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
            {sheet.options.map((o) => (
              <button key={o.label} className="p-bg2" onClick={o.onClick} style={{ minHeight: 58, padding: '10px 12px', border: 'none', borderRadius: 10, background: o.bg, color: o.color, display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', cursor: 'pointer' }}>
                {o.icon && <span style={{ flex: 'none', color: 'var(--primary)' }}>{o.icon}</span>}
                <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: 17, fontWeight: o.weight }}>{o.label}</span>{o.sub && <span style={{ fontSize: 14, color: 'var(--text2)' }}>{o.sub}</span>}</span>
                {o.check && <span style={{ flex: 'none' }}>{o.check}</span>}
              </button>
            ))}
          </div>
        )}
        {sheet.form && (
          <div style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea value={sheet.form.value} onChange={sheet.form.onChange} placeholder={sheet.form.placeholder} maxLength={1000} rows={3} aria-label={sheet.form.placeholder} style={{ ...field, resize: 'none' }} />
            {sheet.form.image && <ImagePicker {...sheet.form.image} />}
            <button className="p-btn" onClick={sheet.form.send.onClick} disabled={sheet.form.send.disabled} style={{ ...btnPrimary, height: 54, opacity: sheet.form.send.disabled ? 0.45 : 1, cursor: sheet.form.send.disabled ? 'default' : 'pointer' }}>{sheet.form.send.label}</button>
          </div>
        )}
        {sheet.confirm && (
          <div style={{ padding: '18px 20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sheet.confirm.alt && <button className="p-btn" onClick={sheet.confirm.alt.onClick} style={{ ...btnPrimary, height: 54 }}>{sheet.confirm.alt.label}</button>}
            <button className="p-danger" onClick={sheet.confirm.onOk} style={{ height: 54, border: 'none', borderRadius: 10, background: 'var(--errorFill)', color: '#fff', font: '600 17px/1 var(--font-body)', cursor: 'pointer' }}>{sheet.confirm.ok}</button>
            <button className="p-cancel" onClick={onClose} style={{ height: 52, border: 'none', borderRadius: 10, background: 'var(--surface2)', color: 'var(--text)', font: '600 17px/1 var(--font-body)', cursor: 'pointer' }}>{sheet.confirm.cancel}</button>
          </div>
        )}
      </div>
    </div>
  );
}
