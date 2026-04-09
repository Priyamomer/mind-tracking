// Shared context menu for nodes, edges, and sessions.

const CtxMenu = (() => {
  const menu      = document.getElementById('ctxMenu');
  const renameBtn = document.getElementById('ctxRename');
  const deleteBtn = document.getElementById('ctxDelete');

  function show(x, y, { renameLabel, deleteLabel, onRename, onDelete }) {
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
    renameBtn.style.display = 'block';
  }

  function isOpen() { return menu.classList.contains('visible'); }

  // Close when clicking outside.
  document.addEventListener('click', e => {
    if (!menu.contains(e.target)) hide();
  });

  return { show, hide, isOpen };
})();
