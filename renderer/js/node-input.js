// Floating input for creating or renaming a node.

const NodeInput = (() => {
  const wrap  = document.getElementById('nodeInputWrap');
  const input = document.getElementById('nodeInput');

  let mode       = null;  // 'create' | 'rename'
  let createPt   = null;
  let renamingId = null;
  let onDone     = null;  // callback() → caller re-renders

  Suggestions.setCommitHandler(label => {
    input.value = label;
    Suggestions.hide();
  });

  function openCreate(pt, cb) {
    mode       = 'create';
    createPt   = pt;
    renamingId = null;
    onDone     = cb;
    input.value = '';
    Suggestions.hide();
    _position(pt.x, pt.y);
    wrap.classList.add('visible');
    input.focus();
  }

  function openRename(node, cb) {
    mode       = 'rename';
    createPt   = null;
    renamingId = node.id;
    onDone     = cb;
    input.value = node.label;
    Suggestions.hide();
    _position(node.x, node.y);
    wrap.classList.add('visible');
    input.focus();
    input.select();
  }

  function close() {
    wrap.classList.remove('visible');
    Suggestions.hide();
    mode = null; createPt = null; renamingId = null;
  }

  function _position(x, y) {
    wrap.style.left = x + 'px';
    wrap.style.top  = y + 'px';
  }

  function _commit() {
    const label = input.value.trim();
    if (!label) { close(); return; }

    if (mode === 'create' && createPt) {
      store.addNode(label, createPt.x, createPt.y);
    } else if (mode === 'rename' && renamingId) {
      store.renameNode(renamingId, label);
    }
    close();
    onDone && onDone();
  }

  input.addEventListener('input', () => {
    Suggestions.render(input.value.trim());
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const label = Suggestions.move(1);
      if (label) input.value = label;
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const label = Suggestions.move(-1);
      if (label) input.value = label;
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const label = Suggestions.firstLabel();
      if (label) { input.value = label; Suggestions.hide(); }
      return;
    }
    if (e.key === 'Enter') { _commit(); return; }
    if (e.key === 'Escape') {
      if (Suggestions.isVisible()) { Suggestions.hide(); return; }
      close();
    }
    e.stopPropagation();
  });

  function isOpen() { return wrap.classList.contains('visible'); }

  return { openCreate, openRename, close, isOpen };
})();
