// Loaded before the app (external file, so the Content-Security-Policy can forbid inline scripts).
// Paint the correct splash/background before React loads to avoid a theme flash.
(function () {
  try {
    var s = JSON.parse(localStorage.getItem('civi:settings') || 'null');
    var old = s ? null : JSON.parse(localStorage.getItem('test-civique:v1') || 'null');
    var t = (s && s.theme) || (old && old.settings && old.settings.theme) || 'system';
    var d = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    var bg = d ? '#0D111A' : '#F5F6F8';
    document.documentElement.dataset.bootTheme = d ? 'dark' : 'light';
    document.documentElement.style.background = bg;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', bg);
  } catch (e) { /* storage unavailable: default theme */ }
})();
