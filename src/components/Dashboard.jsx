import { BRAND_ICON } from '../constants.js';
import { Corners, Bar, btnPrimary, iconBtn, h2s, card } from './ui.jsx';

export function Home({ h }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ padding: '6px 20px 0', display: 'flex', alignItems: 'center', gap: 13 }}>
        <img src={BRAND_ICON} alt="" aria-hidden="true" style={{ width: 52, height: 52, flex: 'none', objectFit: 'contain', filter: 'drop-shadow(0 6px 12px rgba(20,55,130,.12))' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--primaryText)' }}>Civi · Test Civique</div>
          <h1 style={{ margin: 0, font: '600 32px/1.05 var(--font-heading)' }}>Bonjour 👋</h1>
          <button className="p-chip" onClick={h.onPrep} aria-label={'Préparation : ' + h.prepName + '. Changer'} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4, margin: 0, padding: '2px 8px 2px 10px', border: '1px solid var(--line)', borderRadius: 14, background: 'var(--surface)', fontSize: 14, color: 'var(--text2)', cursor: 'pointer' }}>{h.prepName}<span style={{ transform: 'rotate(90deg)', display: 'grid' }}>{h.chev}</span></button>
        </div>
      </div>
      {h.install && (
        <div style={{ padding: '0 20px' }}>
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px 12px 14px' }}>
            <span style={{ width: 40, height: 40, flex: 'none', borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--tint)', color: 'var(--primary)' }}>{h.install.icon}</span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: 16, fontWeight: 600 }}>Installer Civi</span><span style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.3 }}>Sur l’écran d’accueil, plein écran et hors connexion</span></span>
            <button className="p-btn" onClick={h.install.onInstall} style={{ ...btnPrimary, flex: 'none', height: 38, padding: '0 14px', fontSize: 15 }}>Installer</button>
            <button className="p-bg2" onClick={h.install.onDismiss} aria-label="Masquer" style={{ ...iconBtn, width: 36, height: 36, color: 'var(--text2)' }}>{h.install.close}</button>
          </div>
        </div>
      )}
      <div style={{ padding: '0 20px' }}>
        <div className="blueprint" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Corners />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}><span style={{ font: '600 64px/0.9 var(--font-heading)', letterSpacing: '-.02em' }}>{h.prep}</span><span style={{ fontSize: 16, color: 'var(--text2)' }}>de préparation</span></div>
          <Bar w={h.prepW} />
          <div style={{ fontSize: 14, color: 'var(--text2)' }}>{h.goal}</div>
          <button className="p-btn" onClick={h.onCta} disabled={h.loading} style={{ ...btnPrimary, marginTop: 4, height: 56 }}>{h.loading && <span className="spinner" />}{h.ctaLabel}</button>
          <div style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>{h.ctaSub}</div>
        </div>
      </div>
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={h2s}>Que veux-tu faire ?</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {h.tiles.map((t) => (
            <button key={t.label} className="p-tile" onClick={t.onClick} style={{ position: 'relative', gridColumn: t.wide ? '1 / -1' : undefined, minHeight: t.wide ? 104 : 116, padding: 14, border: 'none', borderRadius: 10, background: 'var(--surface)', boxShadow: 'var(--shadowS)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, textAlign: 'left', cursor: 'pointer' }}>
              <span style={{ width: 40, height: 40, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--tint)', color: 'var(--primary)' }}>{t.icon}</span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.2 }}>{t.label}</span><span style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.3 }}>{t.sub}</span></span>
              {t.badge && <span style={{ position: 'absolute', top: 12, right: 12, minWidth: 22, height: 22, padding: '0 6px', borderRadius: 11, background: 'var(--red)', color: '#fff', font: '600 13px/22px var(--font-body)', textAlign: 'center' }}>{t.badge}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TestHero({ t }) {
  return (
    <div style={{ padding: '0 20px' }}>
      <div className="blueprint" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Corners />
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--primaryText)' }}>Conditions réelles</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><h2 style={{ margin: 0, font: '600 30px/1.1 var(--font-heading)' }}>Examen blanc</h2><span style={{ fontSize: 16, color: 'var(--text2)' }}>{t.sub}</span></div>
        <span style={{ fontSize: 14, color: 'var(--text2)' }}>{t.pass}</span>
        <button className="p-btn" onClick={t.onStart} style={{ ...btnPrimary, height: 56 }}>Démarrer l'examen</button>
      </div>
    </div>
  );
}

export function ProgHero({ p }) {
  return (
    <div style={{ padding: '0 20px' }}>
      <div className="blueprint" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Corners />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}><span style={{ font: '600 64px/0.9 var(--font-heading)', letterSpacing: '-.02em' }}>{p.label}</span><span style={{ fontSize: 16, color: 'var(--text2)' }}>{p.sub}</span></div>
        <Bar w={p.w} />
      </div>
    </div>
  );
}

export function Profile({ p }) {
  return (
    <div style={{ padding: '0 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <span style={{ width: 64, height: 64, flex: 'none', borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--tint)', color: 'var(--primaryText)', font: '600 24px/1 var(--font-heading)' }}>{p.initials}</span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}><span style={{ font: '600 22px/1.15 var(--font-heading)' }}>{p.name}</span><span style={{ fontSize: 14, color: 'var(--text2)' }}>{p.sub}</span></span>
    </div>
  );
}
