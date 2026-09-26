(function exposeShortcutHelpers(root, factory) {
  const helpers = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = helpers;
  root.EnglishShelfShortcuts = helpers;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  function shouldFocusSearch(event) {
    if (!event || event.isComposing || event.keyCode === 229 || event.repeat) return false;
    if (!event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) return false;
    return String(event.key || '').toLowerCase() === 'f';
  }

  return { shouldFocusSearch };
});
