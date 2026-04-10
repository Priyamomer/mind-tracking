// Reminder timer — shows the overlay automatically at a set interval.

const Timer = (() => {
  const STORAGE_KEY  = 'lucent-timer';
  const PRESETS      = [1, 2, 5, 10, 15, 20, 30, 60]; // minutes

  const toggleBtn  = document.getElementById('timerToggle');
  const dot        = document.getElementById('timerDot');
  const display    = document.getElementById('timerDisplay');
  const downBtn    = document.getElementById('timerDown');
  const upBtn      = document.getElementById('timerUp');

  let active      = false;
  let intervalMin = 5;

  // ── Persist ────────────────────────────────────────────────────────────────

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        active      = saved.active      ?? false;
        intervalMin = saved.intervalMin ?? 5;
      }
    } catch (e) {}
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ active, intervalMin }));
  }

  // ── IPC ────────────────────────────────────────────────────────────────────

  function startIPC() {
    window.electronAPI?.startTimer(intervalMin * 60 * 1000);
  }

  function stopIPC() {
    window.electronAPI?.stopTimer();
  }

  // ── UI ─────────────────────────────────────────────────────────────────────

  function render() {
    display.textContent = intervalMin === 60 ? '1 hr' : `${intervalMin} min`;

    if (active) {
      dot.classList.add('active');
      toggleBtn.classList.add('active');
      toggleBtn.title = 'Timer ON — click to stop';
    } else {
      dot.classList.remove('active');
      toggleBtn.classList.remove('active');
      toggleBtn.title = 'Timer OFF — click to start';
    }

    // Disable adj buttons at limits
    downBtn.disabled = PRESETS.indexOf(intervalMin) === 0;
    upBtn.disabled   = PRESETS.indexOf(intervalMin) === PRESETS.length - 1;
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  toggleBtn.addEventListener('click', () => {
    active = !active;
    save();
    render();
    active ? startIPC() : stopIPC();
  });

  downBtn.addEventListener('click', () => {
    const i = PRESETS.indexOf(intervalMin);
    if (i > 0) {
      intervalMin = PRESETS[i - 1];
      save();
      render();
      if (active) startIPC(); // restart with new interval
    }
  });

  upBtn.addEventListener('click', () => {
    const i = PRESETS.indexOf(intervalMin);
    if (i < PRESETS.length - 1) {
      intervalMin = PRESETS[i + 1];
      save();
      render();
      if (active) startIPC();
    }
  });

  // ── Boot ───────────────────────────────────────────────────────────────────

  load();
  render();
  if (active) startIPC(); // resume timer across restarts
})();
