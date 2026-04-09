// Tab bar: renders session tabs and handles create / rename / delete / switch.

const Tabs = (() => {
  const tabBar = document.getElementById('tabBar');

  let onRedraw = null;
  function setRedrawHandler(fn) { onRedraw = fn; }

  function render() {
    tabBar.innerHTML = '';

    store.state.sessions.forEach(s => {
      const tab = document.createElement('div');
      tab.className = 'tab' + (s.id === store.state.activeSession ? ' active' : '');
      tab.textContent = s.label;
      tab.dataset.sid = s.id;

      let clickTimer = null;

      tab.addEventListener('click', () => {
        clickTimer = setTimeout(() => {
          store.setActiveSession(s.id);
          onRedraw && onRedraw();
        }, 180);
      });

      tab.addEventListener('dblclick', e => {
        clearTimeout(clickTimer);
        e.stopPropagation();
        _startRenameTab(tab, s);
      });

      tab.addEventListener('contextmenu', e => {
        e.preventDefault();
        CtxMenu.show(e.clientX, e.clientY, {
          renameLabel: 'rename session',
          deleteLabel: 'delete session',
          onRename: () => {
            const live = tabBar.querySelector(`[data-sid="${s.id}"]`);
            if (live) _startRenameTab(live, s);
          },
          onDelete: () => {
            store.deleteSession(s.id);
            onRedraw && onRedraw();
          },
        });
      });

      tabBar.appendChild(tab);
    });

    // Add-session button
    const addBtn = document.createElement('div');
    addBtn.className = 'tab-add';
    addBtn.textContent = '+';
    addBtn.addEventListener('click', () => _promptNewSession());
    tabBar.appendChild(addBtn);

    const spacer = document.createElement('div');
    spacer.className = 'spacer';
    tabBar.appendChild(spacer);
  }

  function _startRenameTab(tabEl, session) {
    const inp = _makeTabInput(session.label);
    tabBar.replaceChild(inp, tabEl);
    inp.focus(); inp.select();

    function commit() {
      const v = inp.value.trim();
      if (v) store.renameSession(session.id, v);
      onRedraw && onRedraw();
    }

    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') onRedraw && onRedraw();
      e.stopPropagation();
    });
    inp.addEventListener('blur', () => { if (inp.isConnected) commit(); });
  }

  function _promptNewSession() {
    const inp = _makeTabInput('');
    inp.placeholder = 'session name…';
    const addBtn = tabBar.querySelector('.tab-add');
    tabBar.insertBefore(inp, addBtn);
    inp.focus();

    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const label = inp.value.trim() || 'session';
        store.addSession(label);
        onRedraw && onRedraw();
      }
      if (e.key === 'Escape') render();
      e.stopPropagation();
    });
    inp.addEventListener('blur', () => { if (inp.isConnected) render(); });
  }

  function _makeTabInput(value) {
    const inp = document.createElement('input');
    inp.className = 'tab-input';
    inp.value = value;
    return inp;
  }

  return { render, setRedrawHandler };
})();
