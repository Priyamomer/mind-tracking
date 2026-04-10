const { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=128');

if (app.dock) app.dock.hide();

let win          = null;
let analyticsWin = null;
let tray         = null;
let shown        = false;

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

  // Clicking X now explicitly quits the background app, as requested by user.
  win.on('close', e => {
    app.exit(0);
  });
}

// Listen for renderer-initiated quit
const { ipcMain } = require('electron');
ipcMain.on('quit-app', () => {
  app.exit(0);
});

// Reload main window (called after reset)
ipcMain.on('reload-main', () => {
  if (win && !win.isDestroyed()) win.reload();
});

// ─── Reminder Timer ───────────────────────────────────────────────────────────
let reminderTimer    = null;
let reminderInterval = 5 * 60 * 1000;
let timerActive      = false;

function scheduleNextReminder() {
  if (!timerActive) return;
  reminderTimer = setTimeout(() => {
    showWindow();
    scheduleNextReminder();
  }, reminderInterval);
}

ipcMain.on('start-timer', (event, ms) => {
  timerActive      = true;
  reminderInterval = ms;
  if (reminderTimer) clearTimeout(reminderTimer);
  scheduleNextReminder();
});

ipcMain.on('stop-timer', () => {
  timerActive = false;
  if (reminderTimer) { clearTimeout(reminderTimer); reminderTimer = null; }
});

// Open analytics window
ipcMain.on('open-analytics', () => {
  if (analyticsWin && !analyticsWin.isDestroyed()) {
    analyticsWin.focus();
    return;
  }
  analyticsWin = new BrowserWindow({
    width: 700,
    height: 540,
    minWidth: 580,
    minHeight: 440,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f0effe',
    title: 'Lucent — Analytics',
    alwaysOnTop: true,
    visibleOnAllWorkspaces: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  analyticsWin.setAlwaysOnTop(true, 'floating');
  analyticsWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  analyticsWin.loadFile(path.join(__dirname, 'renderer', 'analytics.html'));
  analyticsWin.on('closed', () => { analyticsWin = null; });
});

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
