// Captures what the user sees (the .app frame) as a PNG, for question reports. The library is loaded on demand.
export async function captureScreen() {
  const el = document.querySelector('.app'); if (!el) return null;
  const { toBlob } = await import('html-to-image');
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#fff';
  return toBlob(el, { pixelRatio: Math.min(2, window.devicePixelRatio || 1), backgroundColor: bg, cacheBust: true });
}
