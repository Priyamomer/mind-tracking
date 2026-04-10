// Preload runs in a privileged context — keep it minimal.
// All persistence is handled via localStorage in the renderer.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform:      process.platform,
  quitApp:       () => ipcRenderer.send('quit-app'),
  openAnalytics: () => ipcRenderer.send('open-analytics'),
  reloadMain:    () => ipcRenderer.send('reload-main'),
  startTimer:    (ms) => ipcRenderer.send('start-timer', ms),
  stopTimer:     () => ipcRenderer.send('stop-timer'),
});
