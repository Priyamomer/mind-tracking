// Entry point — wires modules together and bootstraps the app.

function renderAll() {
  Tabs.render();
  Canvas.render();
}

// Wire up redraw callbacks so modules can trigger a full re-render.
Tabs.setRedrawHandler(renderAll);
Canvas.setRedrawHandler(renderAll);

// Global Escape key: close any open overlay.
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    NodeInput.close();
    CtxMenu.hide();
  }
});

// Boot.
store.load();
renderAll();
