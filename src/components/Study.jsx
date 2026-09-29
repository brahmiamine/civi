import { ic } from '../Icon.jsx';
import { Corners, Bar, h2s, card } from './ui.jsx';

export function Fiche({ f }) {
  const sk = { background: 'var(--surface2)', borderRadius: 4 };
  return (
    <div style={{ padding: '4px 20px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {f.loading && (
        <div aria-label="Chargement" style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'tcShimmer 1.1s ease-in-out infinite' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}><span style={{ ...sk, width: 52, height: 52, borderRadius: 10 }} /><span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}><span style={{ ...sk, height: 20, width: '80%' }} /><span style={{ ...sk, height: 20, width: '50%' }} /></span></div>
          <span style={{ ...sk, height: 8 }} />
          <span style={{ ...sk, height: 22, width: '40%', marginTop: 8 }} />
          <span style={{ ...sk, height: 220, borderRadius: 10 }} />
        </div>
      )}
      {f.ready && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}><span style={{ width: 52, height: 52, flex: 'none', borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--tint)', color: 'var(--primary)' }}>{f.icon}</span><h1 style={{ margin: 0, font: '600 26px/1.15 var(--font-heading)', textWrap: 'pretty' }}>{f.name}</h1></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text2)' }}><span>{f.sub}</span><span style={{ fontWeight: 600, color: 'var(--text)' }}>{f.pctLabel}</span></div>
            <Bar w={f.pct} />
          </div>
          {f.facts.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 style={h2s}>L'essentiel</h2>
            <div style={card}>
              {f.facts.map((x) => (
                <div key={x.n} style={{ display: 'flex', gap: 14, padding: '14px 16px', borderBottom: x.sep }}><span style={{ flex: 'none', width: 16, font: '600 20px/1.3 var(--font-heading)', color: 'var(--primaryText)' }}>{x.n}</span><span style={{ fontSize: 16, lineHeight: 1.45, textWrap: 'pretty' }}>{x.text}</span></div>
              ))}
            </div>
          </div>}
        </div>
      )}
    </div>
  );
}

export function Flash({ f, cardRef }) {
  return (
    <div style={{ padding: '4px 20px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text2)' }}><span>{f.theme}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{f.counter}</span></div>
      <button ref={cardRef} className="p-card" onClick={f.onFlip} aria-label="Retourner la carte" style={{ minHeight: 400, border: 'none', borderRadius: 12, background: 'var(--surface)', boxShadow: 'var(--shadowM)', padding: '28px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16, textAlign: 'left', cursor: 'pointer', transition: 'transform .1s' }}>
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: f.kColor }}>{f.kicker}</span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><span style={{ font: '600 27px/1.2 var(--font-heading)', textWrap: 'pretty' }}>{f.text}</span>{f.detail && <span style={{ fontSize: 16, lineHeight: 1.5, color: 'var(--text2)', textWrap: 'pretty' }}>{f.detail}</span>}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text2)' }}>{f.flipIcon}{f.hint}</span>
      </button>
    </div>
  );
}

export function QuestionView({ qv }) {
  return (
    <div style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <span style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 600, padding: '4px 8px', borderRadius: 4, background: 'var(--surface2)', color: 'var(--text2)' }}>{qv.theme}</span>
      <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: qv.fs, lineHeight: 1.2, textWrap: 'pretty' }}>{qv.text}</h2>
      <div role="radiogroup" aria-label="Réponses" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {qv.answers.map((a) => (
          <button key={a.key} className="p-answer" onClick={a.onClick} disabled={a.disabled} role="radio" aria-checked={a.checked} aria-label={a.aria} style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 60, padding: '12px 14px', borderRadius: 10, border: a.border, background: a.bg, opacity: a.op, textAlign: 'left', cursor: a.disabled ? 'default' : 'pointer', transition: 'background .18s,border-color .18s,opacity .18s,transform .1s' }}>
            <span style={{ width: 34, height: 34, flex: 'none', display: 'grid', placeItems: 'center', borderRadius: 8, background: a.badgeBg, color: a.badgeColor, font: '600 18px/1 var(--font-heading)', transition: 'background .18s' }}>{a.badge}</span>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: qv.afs, fontWeight: 500, lineHeight: 1.3, color: 'var(--text)' }}>{a.text}</span>{a.note && <span style={{ fontSize: 13, fontWeight: 600, color: a.noteColor }}>{a.note}</span>}</span>
          </button>
        ))}
      </div>
      <button onClick={qv.onReport} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', border: 'none', background: 'none', font: 'inherit', fontSize: 14, color: 'var(--text2)', cursor: 'pointer' }}>{ic('alert', 16)}Signaler une erreur dans cette question</button>
      {qv.explain && (
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10, padding: 16, animation: 'tcRise .25s ease' }}>
          {qv.explain.verdict && <span style={{ display: 'flex', alignItems: 'center', gap: 8, font: '600 18px/1.2 var(--font-heading)', color: qv.explain.vColor }}>{qv.explain.vIcon}{qv.explain.verdict}</span>}
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--primaryText)' }}>{qv.explain.bulb}À retenir</span>
          <span style={{ fontSize: 16, lineHeight: 1.5, textWrap: 'pretty' }}>{qv.explain.text}</span>
        </div>
      )}
    </div>
  );
}

export function Result({ r }) {
  return (
    <div style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="blueprint" style={{ padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
        <Corners />
        <span style={{ fontSize: 14, color: 'var(--text2)' }}>{r.title}</span>
        <div style={{ font: '600 80px/0.9 var(--font-heading)', letterSpacing: '-.02em' }}>{r.score}<span style={{ fontSize: 34, color: 'var(--text2)' }}> / {r.total}</span></div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, background: r.vBg, color: r.vColor, fontSize: 15, fontWeight: 600 }}>{r.vIcon}{r.verdict}</span>
        <span style={{ fontSize: 15, color: 'var(--text2)', textWrap: 'pretty', maxWidth: 260 }}>{r.msg}</span>
      </div>
      <div style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }}>
        {r.stats.map((st) => (
          <div key={st.l} style={{ padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, borderLeft: st.sep }}><span style={{ font: '600 26px/1 var(--font-heading)' }}>{st.v}</span><span style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>{st.l}</span></div>
        ))}
      </div>
    </div>
  );
}
