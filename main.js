const { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=128');

if (app.dock) app.dock.hide();

let win   = null;
let tray  = null;
let shown = false;

// ─── Window ──────────────────────────────────────────────────────────────────

function createWindow() {
  win = new BrowserWindow({
    width: 520,
    height: 420,
    minWidth: 380,
    minHeight: 280,
    frame: true,
    transparent: false,
    backgroundColor: '#1a1a1c',
    titleBarStyle: 'hiddenInset',
    show: false,
    alwaysOnTop: true,
    visibleOnAllWorkspaces: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Close button just hides — process stays alive so ⌥V is always instant.
  win.on('close', e => {
    e.preventDefault();
    hideWindow();
  });
}

// ─── Show / Hide ─────────────────────────────────────────────────────────────

function showWindow() {
  shown = true;

  // Center on whichever screen the cursor is currently on
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const { x, y, width, height } = display.workArea;
  const { width: w, height: h } = win.getBounds();
  win.setPosition(Math.round(x + (width - w) / 2), Math.round(y + (height - h) / 2));

  win.show();
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.focus();
}

function hideWindow() {
  shown = false;
  win.setAlwaysOnTop(false); // drop to normal level so macOS routes focus to previous app
  win.blur();                // explicitly release key status before hiding
  win.hide();
  // do NOT restore alwaysOnTop here — restore happens on next show
}

function toggleWindow() {
  if (!win) return;
  shown ? hideWindow() : showWindow();
}

// ─── Tray ────────────────────────────────────────────────────────────────────

function createTray() {
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHklEQVQ4jWNgYGD4' +
    'TxRmIFMzqpmoZlSbqWYGAQAEsAABJ5Cb+QAAAABJRU5ErkJggg=='
  );
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('Mind Tracker  ⌥V');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show / Hide  ⌥V', click: toggleWindow },
    { type: 'separator' },
    { label: 'Quit', click: () => app.exit(0) },
  ]));
  tray.on('click', toggleWindow);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  createTray();

  const ok = globalShortcut.register('Alt+V', toggleWindow);
  if (!ok) console.error('⌥V shortcut registration failed');

  app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {});
