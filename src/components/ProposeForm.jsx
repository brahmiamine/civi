import { field, ImagePicker, Segmented } from './ui.jsx';

export function ProposeForm({ f }) {
  const { p } = f;
  const label = { fontSize: 13, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text2)' };
  const box = { display: 'flex', flexDirection: 'column', gap: 8 };
  return (
    <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Segmented full label="Type de proposition" items={[['text', 'Question écrite'], ['image', 'Image seulement']].map(([k, l]) => ({ label: l, checked: p.kind === k, onClick: () => f.set({ kind: k }) }))} />
      <div style={{ display: 'flex', gap: 10 }}>
        <label style={{ ...box, flex: 1 }}><span style={label}>Préparation</span>
          <select value={p.prep} onChange={(e) => f.set({ prep: e.target.value })} style={field}>{f.preps.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <label style={{ ...box, flex: 1 }}><span style={label}>Thème</span>
          <select value={p.theme} onChange={(e) => f.set({ theme: e.target.value })} style={field}><option value="">Je ne sais pas</option>{f.themes.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
      </div>
      {p.kind === 'text' ? (<>
      <label style={box}><span style={label}>Question</span>
        <textarea value={p.q} onChange={(e) => f.set({ q: e.target.value })} rows={3} maxLength={600} placeholder="Ex. : Quelle est la devise de la République ?" style={{ ...field, resize: 'vertical' }} /></label>
      <div style={box}><span style={label}>Réponses · touche la lettre de la bonne</span>
        {p.a.map((t, i) => {
          const good = p.c === i;
          return (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button type="button" onClick={() => f.set({ c: good ? null : i })} aria-label={'Bonne réponse : ' + f.LET[i]} aria-pressed={good} style={{ width: 44, height: 44, flex: 'none', borderRadius: 8, border: good ? 'none' : '1px solid var(--line)', background: good ? 'var(--success)' : 'var(--surface)', color: good ? '#fff' : 'var(--text)', font: '600 18px/1 var(--font-heading)', cursor: 'pointer' }}>{good ? '✓' : f.LET[i]}</button>
              <input value={t} onChange={(e) => f.setA(i, e.target.value)} maxLength={300} placeholder={'Réponse ' + f.LET[i] + (i >= 2 ? ' (facultative)' : '')} style={field} />
            </div>
          );
        })}
      </div>
      <label style={box}><span style={label}>À retenir (facultatif)</span>
        <textarea value={p.x} onChange={(e) => f.set({ x: e.target.value })} rows={2} maxLength={600} placeholder="Explication ou source" style={{ ...field, resize: 'vertical' }} /></label>
      </>) : (
        <div style={box}><span style={label}>Image</span>
          <ImagePicker large preview={p.preview} label="Ajouter une photo ou une capture" onPick={f.pick} />
        </div>
      )}
      <label style={box}><span style={label}>Commentaire (facultatif)</span>
        <textarea value={p.note} onChange={(e) => f.set({ note: e.target.value })} rows={2} maxLength={600} placeholder="Source, contexte…" style={{ ...field, resize: 'vertical' }} /></label>
    </div>
  );
}
