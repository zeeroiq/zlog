const storageKey = 'zlog-color-scheme';
const validSchemes = new Set(['system', 'light', 'dark']);

function selectedScheme() {
  try {
    const stored = localStorage.getItem(storageKey);
    return validSchemes.has(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function applyScheme(scheme) {
  document.documentElement.dataset.colorScheme = scheme;
  document.querySelectorAll('input[name="appearance"]').forEach(input => {
    input.checked = input.value === scheme;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  applyScheme(selectedScheme());

  document.querySelectorAll('input[name="appearance"]').forEach(input => {
    input.addEventListener('change', event => {
      const scheme = event.target.value;
      if (!validSchemes.has(scheme)) {
        return;
      }
      try {
        localStorage.setItem(storageKey, scheme);
      } catch {
        // The control still updates this page when persistent storage is unavailable.
      }
      applyScheme(scheme);
    });
  });
});
