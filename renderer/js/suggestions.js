// Autocomplete suggestions for the node input.

const Suggestions = (() => {
  const el      = document.getElementById('suggestions');
  let index     = -1;
  let onCommit  = null;   // callback(label)

  function allLabels() {
    const seen = new Set();
    return store.state.nodes
      .filter(n => { const k = n.label.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
      .map(n => n.label);
  }

  function render(query) {
    el.innerHTML = '';
    index = -1;
    if (!query) { hide(); return; }
    const q = query.toLowerCase();
    const matches = allLabels().filter(l => l.toLowerCase().startsWith(q) && l.toLowerCase() !== q);
    if (!matches.length) { hide(); return; }
    matches.slice(0, 5).forEach(label => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      const matchPart = label.slice(0, query.length);
      const restPart  = label.slice(query.length);
      item.innerHTML  = `<span class="suggestion-match">${matchPart}</span>${restPart}`;
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        if (onCommit) onCommit(label);
      });
      el.appendChild(item);
    });
    el.classList.add('visible');
  }

  function move(dir) {
    const items = el.querySelectorAll('.suggestion-item');
    if (!items.length) return null;
    items[index]?.classList.remove('focused');
    index = (index + dir + items.length) % items.length;
    items[index].classList.add('focused');
    return items[index].textContent;
  }

  function firstLabel() {
    const first = el.querySelector('.suggestion-item');
    return first ? first.textContent : null;
  }

  function hide() {
    el.classList.remove('visible');
    index = -1;
  }

  function isVisible() { return el.classList.contains('visible'); }

  function setCommitHandler(fn) { onCommit = fn; }

  return { render, move, firstLabel, hide, isVisible, setCommitHandler };
})();
