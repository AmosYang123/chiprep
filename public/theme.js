const systemTheme = matchMedia('(prefers-color-scheme: dark)');
let preference = 'system';
try { preference = localStorage.getItem('ting-clone-theme') || 'system'; } catch {}
function applyTheme() {
  document.documentElement.dataset.theme = preference === 'system' ? (systemTheme.matches ? 'dark' : 'light') : preference;
  const select = document.querySelector('[data-theme-select]');
  if (select) select.value = preference;
}
applyTheme();
systemTheme.addEventListener('change', applyTheme);
document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  document.querySelector('[data-theme-select]')?.addEventListener('change', event => {
    preference = event.target.value;
    try { localStorage.setItem('ting-clone-theme', preference); } catch {}
    applyTheme();
  });
});
