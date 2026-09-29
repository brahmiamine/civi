import { ic } from '../Icon.jsx';

export const Corners = () => (<><i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" /></>);

export const Bar = ({ w, h = 8 }) => (
  <div role="progressbar" style={{ height: h, background: 'var(--surface2)', borderRadius: h / 2, overflow: 'hidden' }}>
    <div style={{ height: '100%', width: w, background: 'var(--primary)', borderRadius: h / 2, transition: 'width .6s ease' }} />
  </div>
);

export const btnPrimary = { border: 'none', borderRadius: 10, background: 'var(--btn)', color: 'var(--onBtn)', font: '600 17px/1 var(--font-body)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer' };

export const iconBtn = { width: 44, height: 44, flex: 'none', border: 'none', background: 'transparent', borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer' };

export const h2s = { margin: 0, font: '600 21px/1.2 var(--font-heading)' };

export const card = { background: 'var(--surface)', borderRadius: 10, boxShadow: 'var(--shadowS)' };

export const field = { width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', font: '400 16px/1.4 var(--font-body)' };
const smallBtn = { padding: '8px 12px', border: 'none', borderRadius: 8, font: '600 14px/1 var(--font-body)', cursor: 'pointer' };

// Optional image attachment: a dashed « add » button, then a preview with « Retirer ». `large` shows a big preview.
export function ImagePicker({ preview, label, onPick, large }) {
  if (!preview) {
    return (
      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: large ? 64 : 48, borderRadius: 10, border: '1px dashed var(--line)', background: large ? 'var(--surface)' : 'transparent', color: 'var(--primaryText)', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
        {ic('download', 18)}{label}
        <input type="file" accept="image/*" onChange={(e) => onPick(e.target.files[0])} style={{ display: 'none' }} />
      </label>
    );
  }
  if (large) {
    return (
      <div style={{ position: 'relative' }}>
        <img src={preview} alt="Aperçu" style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 10, background: 'var(--surface2)' }} />
        <button type="button" onClick={() => onPick(null)} style={{ ...smallBtn, position: 'absolute', top: 8, right: 8, background: 'var(--scrim)', color: '#fff' }}>Retirer</button>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <img src={preview} alt="Capture" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />
      <span style={{ flex: 1, fontSize: 15, color: 'var(--text2)' }}>Image jointe</span>
      <button type="button" onClick={() => onPick(null)} style={{ ...smallBtn, background: 'var(--surface2)', color: 'var(--text)' }}>Retirer</button>
    </div>
  );
}
