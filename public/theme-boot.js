// Runs before the app bundle to apply the saved theme and font size,
// avoiding a light "flash" when the user prefers dark mode.
(function () {
  var root = document.documentElement;
  var theme = 'system';
  var fontScale = 1;
  try {
    var saved = JSON.parse(localStorage.getItem('stemsim.settings') || '{}').state || {};
    if (saved.theme === 'light' || saved.theme === 'dark' || saved.theme === 'system') {
      theme = saved.theme;
    }
    if (typeof saved.fontScale === 'number' && saved.fontScale > 0) fontScale = saved.fontScale;
    if (saved.locale === 'en' || saved.locale === 'vi') root.lang = saved.locale;
  } catch (e) {
    /* storage unavailable: keep defaults */
  }
  if (theme === 'system') {
    theme =
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
  }
  root.dataset.theme = theme;
  root.style.setProperty('--font-scale', String(fontScale));
})();
