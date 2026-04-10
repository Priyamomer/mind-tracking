// Analytics window — reads events from Firestore and renders tabs.

(async () => {
  // ── Timezone helper ────────────────────────────────────────────────────────

  function getTZ() {
    return localStorage.getItem('lucent-timezone') ||
           Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  function toLocalDate(ts) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(ts)); // "YYYY-MM-DD"
  }

  function toLocalHour(ts) {
    const h = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour: 'numeric', hour12: false,
    }).format(new Date(ts));
    return parseInt(h) % 24; // guard against "24"
  }

  function toLocalDayOfWeek(ts) {
    // 0=Sun, 1=Mon, ..., 6=Sat in local timezone
    const dayName = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' })
      .format(new Date(ts));
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(dayName);
  }

  function formatDate(dateStr) {
    // "2024-04-10" → "April 10"
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  }

  // ── Fetch ──────────────────────────────────────────────────────────────────

  let events = [];
  let tz     = getTZ();

  async function fetchEvents() {
    console.log('[Analytics] FirebaseDB:', FirebaseDB);
    console.log('[Analytics] db:', FirebaseDB.db);
    console.log('[Analytics] USER_ID:', FirebaseDB.USER_ID);
    if (!FirebaseDB.db) throw new Error('Firestore not initialized — check firebase.js init');
    const path = `users/${FirebaseDB.USER_ID}/events`;
    console.log('[Analytics] fetching collection:', path);
    const snap = await FirebaseDB.db.collection(path).get();
    console.log('[Analytics] snap size:', snap.size, '| empty:', snap.empty);
    events = snap.docs.map(d => d.data()).sort((a, b) => a.timestamp - b.timestamp);
    console.log('[Analytics] first event sample:', events[0]);
  }

  // ── Process ────────────────────────────────────────────────────────────────

  function process() {
    const nodeCounts    = {}; // node_id → { label, count }
    const sessionCounts = {}; // session_id → { label, count }
    const dailyData     = {}; // 'YYYY-MM-DD' → { total, nodes: { id → { label, count } } }
    const hourly        = new Array(24).fill(0);
    const heatmap       = Array.from({ length: 7 }, () => new Array(24).fill(0)); // [day][hour]
    const periods       = { Night: 0, Morning: 0, Afternoon: 0, Evening: 0 };
    const transitions   = {}; // 'a→b' → { fromLabel, toLabel, count }

    // Build label map from latest event per node
    const nodeLabelMap = {};
    events.forEach(ev => { nodeLabelMap[ev.node_id] = ev.node_label; });

    events.forEach(ev => {
      // node counts
      if (!nodeCounts[ev.node_id]) nodeCounts[ev.node_id] = { label: ev.node_label, count: 0 };
      nodeCounts[ev.node_id].count++;

      // session counts
      if (!sessionCounts[ev.session_id])
        sessionCounts[ev.session_id] = { label: ev.session_label || ev.session_id, count: 0 };
      sessionCounts[ev.session_id].count++;

      // daily
      const date = toLocalDate(ev.timestamp);
      if (!dailyData[date]) dailyData[date] = { total: 0, nodes: {} };
      dailyData[date].total++;
      if (!dailyData[date].nodes[ev.node_id])
        dailyData[date].nodes[ev.node_id] = { label: ev.node_label, count: 0 };
      dailyData[date].nodes[ev.node_id].count++;

      // hourly + heatmap + periods
      const h   = toLocalHour(ev.timestamp);
      const dow = toLocalDayOfWeek(ev.timestamp);
      if (h >= 0 && h < 24) {
        hourly[h]++;
        if (dow >= 0) heatmap[dow][h]++;
        if (h >= 6  && h < 12) periods.Morning++;
        else if (h >= 12 && h < 18) periods.Afternoon++;
        else if (h >= 18 && h < 22) periods.Evening++;
        else periods.Night++;
      }

      // transitions
      if (ev.prev_node_id && ev.prev_node_id !== ev.node_id) {
        const key = `${ev.prev_node_id}→${ev.node_id}`;
        if (!transitions[key]) {
          transitions[key] = {
            fromLabel: nodeLabelMap[ev.prev_node_id] || ev.prev_node_id,
            toLabel:   ev.node_label,
            count:     0,
          };
        }
        transitions[key].count++;
      }
    });

    return { nodeCounts, sessionCounts, dailyData, hourly, heatmap, periods, transitions };
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  function barRow(label, count, max, cls = '') {
    const pct = max > 0 ? Math.round((count / max) * 100) : 0;
    return `
      <div class="a-bar-row">
        <span class="a-bar-label" title="${label}">${label}</span>
        <div class="a-bar-track"><div class="a-bar-fill ${cls}" style="width:${pct}%"></div></div>
        <span class="a-bar-count">${count}</span>
      </div>`;
  }

  // ── Tab renderers ──────────────────────────────────────────────────────────

  function renderOverview(data) {
    const { nodeCounts, sessionCounts } = data;
    const total    = events.length;
    const today    = toLocalDate(Date.now());
    const todayCount = events.filter(ev => toLocalDate(ev.timestamp) === today).length;

    const topNodes = Object.values(nodeCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
    const maxNode  = topNodes[0]?.count || 1;

    const topSessions = Object.values(sessionCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    const maxSess = topSessions[0]?.count || 1;

    if (total === 0) return '<div class="a-empty">No events yet — click a node to start tracking.</div>';

    return `
      <div class="a-stats">
        <div class="a-stat">
          <div class="a-stat-value">${total}</div>
          <div class="a-stat-label">total clicks</div>
        </div>
        <div class="a-stat">
          <div class="a-stat-value">${todayCount}</div>
          <div class="a-stat-label">today</div>
        </div>
        <div class="a-stat">
          <div class="a-stat-value">${Object.keys(nodeCounts).length}</div>
          <div class="a-stat-label">nodes tracked</div>
        </div>
      </div>

      <div class="a-section-title">Top Thoughts</div>
      <div class="a-bars">
        ${topNodes.map((n, i) => barRow(n.label, n.count, maxNode, i < 3 ? 'hot' : '')).join('')}
      </div>

      <div class="a-section-title">Sessions</div>
      <div class="a-bars">
        ${topSessions.map(s => barRow(s.label, s.count, maxSess)).join('')}
      </div>`;
  }

  function renderDaily(data) {
    const { dailyData } = data;
    const days = Object.keys(dailyData).sort((a, b) => b.localeCompare(a)).slice(0, 14);

    if (days.length === 0) return '<div class="a-empty">No events yet.</div>';

    return days.map(date => {
      const day   = dailyData[date];
      const nodes = Object.values(day.nodes).sort((a, b) => b.count - a.count);
      const max   = nodes[0]?.count || 1;

      return `
        <div class="a-day">
          <div class="a-day-header">
            <span class="a-day-date">${formatDate(date)}</span>
            <span class="a-day-total">${day.total} click${day.total !== 1 ? 's' : ''}</span>
          </div>
          <div class="a-day-bars">
            ${nodes.map(n => `
              <div class="a-day-bar-row">
                <span class="a-bar-label" title="${n.label}">${n.label}</span>
                <div class="a-bar-track">
                  <div class="a-bar-fill" style="width:${Math.round((n.count / max) * 100)}%"></div>
                </div>
                <span class="a-bar-count">${n.count}</span>
              </div>`).join('')}
          </div>
        </div>`;
    }).join('');
  }

  function renderTimeline(data) {
    // ── Node filter ──
    const allLabels  = [...new Set(events.map(e => e.node_label).filter(Boolean))].sort();
    const filtered   = timelineFilter === 'all'
      ? events
      : events.filter(e => e.node_label === timelineFilter);

    // Recompute hourly/heatmap/periods from filtered events
    const hourly  = new Array(24).fill(0);
    const heatmap = Array.from({ length: 7 }, () => new Array(24).fill(0));
    const periods = { Night: 0, Morning: 0, Afternoon: 0, Evening: 0 };

    filtered.forEach(ev => {
      const h   = toLocalHour(ev.timestamp);
      const dow = toLocalDayOfWeek(ev.timestamp);
      if (h >= 0 && h < 24) {
        hourly[h]++;
        if (dow >= 0) heatmap[dow][h]++;
        if (h >= 6  && h < 12) periods.Morning++;
        else if (h >= 12 && h < 18) periods.Afternoon++;
        else if (h >= 18 && h < 22) periods.Evening++;
        else periods.Night++;
      }
    });

    const nodeOptions = [`<option value="all">All nodes (${events.length})</option>`,
      ...allLabels.map(l => {
        const cnt = events.filter(e => e.node_label === l).length;
        return `<option value="${l}" ${timelineFilter === l ? 'selected' : ''}>${l} (${cnt})</option>`;
      })].join('');

    const maxHourly = Math.max(...hourly, 1);
    const peak      = hourly.indexOf(Math.max(...hourly));

    // ── Hourly bar chart ──
    const bars = hourly.map((count, h) => {
      const pct = Math.round((count / maxHourly) * 100);
      return `<div class="a-hour-bar" style="height:${Math.max(pct, 2)}%"
        title="${h}:00 — ${count} click${count !== 1 ? 's' : ''}"></div>`;
    }).join('');

    const labels = Array.from({ length: 24 }, (_, h) => {
      const show = h % 6 === 0 || h === 23;
      return `<span class="a-hour-label">${show ? h : ''}</span>`;
    }).join('');

    // ── Time period breakdown ──
    const periodDefs = [
      { key: 'Morning',   range: '6–12',  icon: '🌅' },
      { key: 'Afternoon', range: '12–18', icon: '☀️' },
      { key: 'Evening',   range: '18–22', icon: '🌆' },
      { key: 'Night',     range: '22–6',  icon: '🌙' },
    ];
    const maxPeriod = Math.max(...Object.values(periods), 1);
    const periodBars = periodDefs.map(p => {
      const count = periods[p.key];
      const pct   = Math.round((count / maxPeriod) * 100);
      return `
        <div class="a-period-row">
          <span class="a-period-label">${p.icon} ${p.key} <span class="a-period-range">${p.range}</span></span>
          <div class="a-bar-track"><div class="a-bar-fill" style="width:${pct}%"></div></div>
          <span class="a-bar-count">${count}</span>
        </div>`;
    }).join('');

    // ── Day × Hour heatmap ──
    const DAYS    = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const allVals = heatmap.flat();
    const maxHeat = Math.max(...allVals, 1);

    const heatRows = DAYS.map((day, d) => {
      const cells = heatmap[d].map((count, h) => {
        const intensity = count / maxHeat;
        const opacity   = count === 0 ? 0.06 : 0.15 + intensity * 0.85;
        return `<div class="a-heat-cell" style="opacity:${opacity.toFixed(2)}"
          title="${day} ${h}:00 — ${count} click${count !== 1 ? 's' : ''}"></div>`;
      }).join('');
      return `
        <div class="a-heat-row">
          <span class="a-heat-day">${day}</span>
          <div class="a-heat-cells">${cells}</div>
        </div>`;
    }).join('');

    const heatHourLabels = Array.from({ length: 24 }, (_, h) => {
      const show = h % 6 === 0 || h === 23;
      return `<span class="a-heat-hour-label">${show ? h : ''}</span>`;
    }).join('');

    return `
      <div class="a-timeline-filter-row">
        <span class="a-section-title" style="margin:0">Filter by node</span>
        <select class="a-node-select" id="nodeFilter">${nodeOptions}</select>
      </div>

      <div class="a-section-title">Hour of Day (${tz})</div>
      <div class="a-timeline-wrap">
        <div class="a-timeline">${bars}</div>
        <div class="a-hour-labels">${labels}</div>
      </div>
      ${maxHourly > 1 ? `<div class="a-tz-note" style="margin-bottom:20px">Peak at ${peak}:00 with ${hourly[peak]} clicks.</div>` : ''}

      <div class="a-section-title">Time of Day Breakdown</div>
      <div class="a-period-wrap">${periodBars}</div>

      <div class="a-section-title" style="margin-top:20px">Day × Hour Heatmap</div>
      <div class="a-heatmap-wrap">
        ${heatRows}
        <div class="a-heat-footer">
          <span class="a-heat-day"></span>
          <div class="a-heat-cells">${heatHourLabels}</div>
        </div>
      </div>`;
  }

  function renderTransitions(data) {
    const { transitions } = data;
    const rows = Object.values(transitions)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    if (rows.length === 0)
      return '<div class="a-empty">No transitions yet — click multiple different nodes to see patterns.</div>';

    return `
      <div class="a-section-title">Thought Transitions</div>
      <div class="a-transitions">
        ${rows.map(t => `
          <div class="a-transition-row">
            <div class="a-transition-path">
              <span>${t.fromLabel}</span>
              <span class="a-transition-arrow">→</span>
              <span>${t.toLabel}</span>
            </div>
            <span class="a-transition-count">${t.count}×</span>
          </div>`).join('')}
      </div>`;
  }

  const TIMEZONES = [
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Toronto',  'America/Vancouver', 'America/Sao_Paulo',
    'Europe/London',    'Europe/Paris',   'Europe/Berlin',  'Europe/Moscow',
    'Africa/Cairo',     'Asia/Dubai',     'Asia/Kolkata',   'Asia/Dhaka',
    'Asia/Bangkok',     'Asia/Singapore', 'Asia/Shanghai',  'Asia/Tokyo',
    'Australia/Sydney', 'Pacific/Auckland',
  ];

  function renderTimezone() {
    const current = getTZ();
    const options = TIMEZONES.map(z =>
      `<option value="${z}" ${z === current ? 'selected' : ''}>${z.replace('_', ' ')}</option>`
    ).join('');

    return `
      <div class="a-section-title">Time Zone</div>
      <div class="a-tz-wrap">
        <label class="a-tz-label">
          Daily summary and timeline group events by this timezone.
        </label>
        <select class="a-tz-select" id="tzSelect">${options}</select>
        <div class="a-tz-hint">
          Currently detected: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
        </div>
      </div>`;
  }

  // ── Tab switching ──────────────────────────────────────────────────────────

  let activeTab      = 'overview';
  let timelineFilter = 'all'; // node_label or 'all'

  function switchTab(tab) {
    activeTab = tab;
    tz = getTZ();

    document.querySelectorAll('.a-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === tab)
    );

    const content = document.getElementById('aContent');
    const data    = process();

    if (tab === 'overview')         content.innerHTML = renderOverview(data);
    else if (tab === 'daily')       content.innerHTML = renderDaily(data);
    else if (tab === 'transitions') content.innerHTML = renderTransitions(data);
    else if (tab === 'timeline') {
      content.innerHTML = renderTimeline(data);
      document.getElementById('nodeFilter').addEventListener('change', e => {
        timelineFilter = e.target.value;
        switchTab('timeline');
      });
    }
    else if (tab === 'timezone') {
      content.innerHTML = renderTimezone();
      document.getElementById('tzSelect').addEventListener('change', e => {
        localStorage.setItem('lucent-timezone', e.target.value);
        tz = e.target.value;
      });
    }
  }

  async function refresh() {
    const btn = document.getElementById('aRefresh');
    if (btn) { btn.classList.add('spinning'); btn.disabled = true; }
    try {
      await fetchEvents();
      switchTab(activeTab);
    } catch (e) {
      console.error('[Analytics] refresh error:', e);
    } finally {
      if (btn) { btn.classList.remove('spinning'); btn.disabled = false; }
    }
  }

  // ── Boot ───────────────────────────────────────────────────────────────────

  document.querySelectorAll('.a-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.getElementById('aRefresh').addEventListener('click', refresh);

  document.getElementById('aReset').addEventListener('click', async () => {
    const confirmed = confirm('This will permanently delete all nodes, sessions, edges, and click events.\n\nAre you sure?');
    if (!confirmed) return;

    const btn = document.getElementById('aReset');
    btn.disabled = true;
    btn.textContent = 'Resetting…';

    try {
      // Wipe Firestore events
      await FirebaseDB.deleteAllEvents();
      // Wipe localStorage state (store.resetAll reads from the shared localStorage)
      localStorage.removeItem('mindtracker_v1');
      // Reload main overlay window
      if (window.electronAPI?.reloadMain) window.electronAPI.reloadMain();
      // Reset analytics view
      events = [];
      switchTab('overview');
    } catch (e) {
      console.error('[Analytics] reset error:', e);
      alert('Reset failed: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Reset';
    }
  });

  try {
    await fetchEvents();
    switchTab('overview');
  } catch (e) {
    console.error('[Analytics] boot error:', e);
    document.getElementById('aContent').innerHTML =
      `<div class="a-empty" style="color:red;font-size:12px;padding:20px;">
        Error: ${e.message}<br><br>
        Path: users/${FirebaseDB.USER_ID}/events<br><br>
        Check DevTools console for details.
      </div>`;
  }
})();
