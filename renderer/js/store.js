// State management + localStorage persistence.

const STORAGE_KEY = 'mindtracker_v1';

const store = (() => {
  let state = {
    sessions: [{ id: uid(), label: 'deep work sprint' }],
    activeSession: null,
    nodes: [],
    edges: [],
    events: [],
  };
  state.activeSession = state.sessions[0].id;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) state = JSON.parse(raw);
    } catch (e) {}
    if (!state.activeSession && state.sessions.length) {
      state.activeSession = state.sessions[0].id;
    }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  // Derived selectors
  function sessionNodes() {
    return state.nodes.filter(n => n.session_id === state.activeSession);
  }

  function sessionEdges() {
    return state.edges.filter(e => e.session_id === state.activeSession);
  }

  function nodeCount(nodeId) {
    return state.events.filter(e => e.node_id === nodeId).length;
  }

  // Mutators
  function addNode(label, x, y) {
    const node = { id: uid(), session_id: state.activeSession, label, x, y, created_at: Date.now() };
    state.nodes.push(node);
    save();
    return node;
  }

  function renameNode(nodeId, label) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (node) { node.label = label; save(); }
  }

  function moveNode(nodeId, x, y) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (node) { node.x = x; node.y = y; }
  }

  function deleteNode(nodeId) {
    state.nodes  = state.nodes.filter(n => n.id !== nodeId);
    state.edges  = state.edges.filter(e => e.from_node_id !== nodeId && e.to_node_id !== nodeId);
    state.events = state.events.filter(ev => ev.node_id !== nodeId);
    save();
  }

  function recordEvent(nodeId) {
    state.events.push({ id: uid(), node_id: nodeId, session_id: state.activeSession, timestamp: Date.now() });
    save();
  }

  function addEdge(fromId, toId) {
    const exists = state.edges.find(e => e.from_node_id === fromId && e.to_node_id === toId);
    if (exists) return;
    state.edges.push({ id: uid(), session_id: state.activeSession, from_node_id: fromId, to_node_id: toId, created_at: Date.now() });
    save();
  }

  function deleteEdge(edgeId) {
    state.edges = state.edges.filter(e => e.id !== edgeId);
    save();
  }

  function addSession(label) {
    const s = { id: uid(), label };
    state.sessions.push(s);
    state.activeSession = s.id;
    save();
    return s;
  }

  function renameSession(sessionId, label) {
    const s = state.sessions.find(x => x.id === sessionId);
    if (s) { s.label = label; save(); }
  }

  function deleteSession(sessionId) {
    if (state.sessions.length <= 1) return;
    state.sessions = state.sessions.filter(x => x.id !== sessionId);
    state.nodes  = state.nodes.filter(x => x.session_id !== sessionId);
    state.edges  = state.edges.filter(x => x.session_id !== sessionId);
    state.events = state.events.filter(x => x.session_id !== sessionId);
    if (state.activeSession === sessionId) state.activeSession = state.sessions[0].id;
    save();
  }

  function setActiveSession(sessionId) {
    state.activeSession = sessionId;
    save();
  }

  return {
    get state() { return state; },
    load, save,
    sessionNodes, sessionEdges, nodeCount,
    addNode, renameNode, moveNode, deleteNode, recordEvent,
    addEdge, deleteEdge,
    addSession, renameSession, deleteSession, setActiveSession,
  };
})();
