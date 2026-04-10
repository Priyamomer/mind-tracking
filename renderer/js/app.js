// Entry point — wires modules together and bootstraps the app.

function renderAll() {
  Tabs.render();
  Canvas.render();
}

// Wire up redraw callbacks so modules can trigger a full re-render.
Tabs.setRedrawHandler(renderAll);
Canvas.setRedrawHandler(renderAll);

// Re-render canvas when theme is toggled so SVG colour attributes refresh.
document.getElementById('themeToggle').addEventListener('click', () => {
  // Short delay lets CSS variable values settle before we read them.
  setTimeout(renderAll, 30);
});

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
