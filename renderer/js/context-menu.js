// Shared context menu for nodes, edges, and sessions.

const CtxMenu = (() => {
  const menu      = document.getElementById('ctxMenu');
  const undoBtn   = document.getElementById('ctxUndo');
  const renameBtn = document.getElementById('ctxRename');
  const deleteBtn = document.getElementById('ctxDelete');

  function show(x, y, { undoLabel, onUndo, renameLabel, deleteLabel, onRename, onDelete }) {
    if (undoLabel) {
      undoBtn.style.display = 'block';
      undoBtn.textContent   = undoLabel;
      undoBtn.onclick       = () => { hide(); onUndo && onUndo(); };
    } else {
      undoBtn.style.display = 'none';
    }

    if (renameLabel) {
      renameBtn.style.display = 'block';
      renameBtn.textContent   = renameLabel;
      renameBtn.onclick       = () => { hide(); onRename && onRename(); };
    } else {
      renameBtn.style.display = 'none';
    }

    deleteBtn.textContent = deleteLabel || 'delete';
    deleteBtn.onclick     = () => { hide(); onDelete && onDelete(); };

    menu.style.left = x + 'px';
    menu.style.top  = y + 'px';
    menu.classList.add('visible');
  }

  function hide() {
    menu.classList.remove('visible');
    undoBtn.style.display   = 'block';
    renameBtn.style.display = 'block';
  }

  function isOpen() { return menu.classList.contains('visible'); }

  // Close when clicking outside.
  document.addEventListener('click', e => {
    if (!menu.contains(e.target)) hide();
  });

  return { show, hide, isOpen };
})();
