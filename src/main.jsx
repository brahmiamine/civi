import { StrictMode, Component } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { initUpdates } from './update.js';
import { exportData, clearData } from './storage.js';
import { APP_VERSION } from './constants.js';

initUpdates();

// Last line of defence: an unexpected error shows a way out instead of a blank screen.
class ErrorBoundary extends Component {
  state = { error: null, confirm: false };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('[Civi]', error, info?.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    const btn = { height: 50, border: 'none', borderRadius: 10, font: '600 16px/1 system-ui, sans-serif', cursor: 'pointer' };
    const reset = () => {
      if (!this.state.confirm) return this.setState({ confirm: true });
      clearData(); location.reload();
    };
    return (
      <div role="alert" style={{ minHeight: '100%', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--bg, #F5F6F8)', color: 'var(--text, #141821)', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 26 }}>Oups, un problème est survenu</h1>
          <p style={{ margin: 0, lineHeight: 1.5 }}>Recharge l’application. Si le problème revient, exporte ta progression puis réinitialise l’application.</p>
          <button onClick={() => location.reload()} style={{ ...btn, background: '#2447A8', color: '#fff' }}>Recharger</button>
          <button onClick={() => exportData(APP_VERSION)} style={{ ...btn, background: 'var(--surface2, #ECEEF2)', color: 'inherit' }}>Exporter ma progression</button>
          <button onClick={reset} style={{ ...btn, background: '#C22835', color: '#fff' }}>{this.state.confirm ? 'Confirmer : tout effacer' : 'Réinitialiser l’application'}</button>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
