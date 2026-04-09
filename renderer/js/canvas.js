// SVG canvas: renders nodes, edges, drag-edge, pulses, and handles pointer events.

const Canvas = (() => {
  const svgEl         = document.getElementById('svg');
  const edgeLayer     = document.getElementById('edgeLayer');
  const nodeLayer     = document.getElementById('nodeLayer');
  const dragEdgeLayer = document.getElementById('dragEdgeLayer');
  const pulseLayer    = document.getElementById('pulseLayer');
  const hint          = document.getElementById('hint');

  // Interaction state
  let dragging       = null;
  let edgeDrawing    = null;
  let longPressTimer = null;
  let pointerMoved   = false;

  // Called by app.js after any state mutation.
  let onRedraw = null;
  function setRedrawHandler(fn) { onRedraw = fn; }

  // ─── Rendering ───────────────────────────────────────────────────────────

  function renderEdges() {
    edgeLayer.innerHTML = '';
    store.sessionEdges().forEach(edge => {
      const from = store.state.nodes.find(n => n.id === edge.from_node_id);
      const to   = store.state.nodes.find(n => n.id === edge.to_node_id);
      if (!from || !to) return;

      const angle  = Math.atan2(to.y - from.y, to.x - from.x);
      const fromR  = nodeRadius(store.nodeCount(from.id));
      const toR    = nodeRadius(store.nodeCount(to.id));
      const x1 = from.x + Math.cos(angle) * (fromR + 2);
      const y1 = from.y + Math.sin(angle) * (fromR + 2);
      const x2 = to.x   - Math.cos(angle) * (toR   + 6);
      const y2 = to.y   - Math.sin(angle) * (toR   + 6);

      const line = _svgEl('line');
      line.setAttribute('x1', x1); line.setAttribute('y1', y1);
      line.setAttribute('x2', x2); line.setAttribute('y2', y2);
      line.setAttribute('stroke', 'rgba(127,119,221,0.3)');
      line.setAttribute('stroke-width', '1');
      line.setAttribute('marker-end', 'url(#arr)');
      line.setAttribute('fill', 'none');
      line.addEventListener('contextmenu', e => {
        e.preventDefault();
        CtxMenu.show(e.clientX, e.clientY, {
          deleteLabel: 'delete edge',
          onDelete: () => { store.deleteEdge(edge.id); onRedraw && onRedraw(); },
        });
      });
      edgeLayer.appendChild(line);
    });
  }

  function renderNodes() {
    nodeLayer.innerHTML = '';
    const nodes = store.sessionNodes();
    hint.style.display = nodes.length === 0 ? 'block' : 'none';

    nodes.forEach(node => {
      const count = store.nodeCount(node.id);
      const r     = nodeRadius(count);
      const hot   = count >= 3;
      const g     = _svgEl('g');
      g.style.cursor = 'pointer';

      if (hot) {
        const ring = _svgEl('circle');
        ring.setAttribute('cx', node.x); ring.setAttribute('cy', node.y);
        ring.setAttribute('r', r + 7);
        ring.setAttribute('fill', 'none');
        ring.setAttribute('stroke', 'rgba(175,169,236,0.18)');
        ring.setAttribute('stroke-width', '1');
        g.appendChild(ring);
      }

      const circle = _svgEl('circle');
      circle.setAttribute('cx', node.x); circle.setAttribute('cy', node.y);
      circle.setAttribute('r', r);
      circle.setAttribute('fill',   hot ? 'rgba(83,74,183,0.28)'    : 'rgba(36,34,52,1)');
      circle.setAttribute('stroke', hot ? 'rgba(175,169,236,0.85)'  : 'rgba(127,119,221,0.45)');
      circle.setAttribute('stroke-width', '1');
      g.appendChild(circle);

      const { el: labelEl, labelBlockH } = buildNodeLabel(node.label, node.x, node.y, r, count > 0);
      g.appendChild(labelEl);

      if (count > 0) {
        const countEl = _svgEl('text');
        countEl.setAttribute('x', node.x);
        countEl.setAttribute('y', countTextY(node.y, labelBlockH));
        countEl.setAttribute('text-anchor', 'middle');
        countEl.setAttribute('dominant-baseline', 'central');
        countEl.setAttribute('fill',        hot ? '#AFA9EC' : 'rgba(175,169,236,0.85)');
        countEl.setAttribute('font-size',   COUNT_FONT);
        countEl.setAttribute('font-weight', '500');
        countEl.setAttribute('font-family', 'system-ui, sans-serif');
        countEl.textContent = count;
        g.appendChild(countEl);
      }

      _attachNodeEvents(g, node);
      nodeLayer.appendChild(g);
    });
  }

  function renderDragEdge(toX, toY) {
    dragEdgeLayer.innerHTML = '';
    if (!edgeDrawing) return;
    const line = _svgEl('line');
    line.setAttribute('x1', edgeDrawing.fromX); line.setAttribute('y1', edgeDrawing.fromY);
    line.setAttribute('x2', toX);               line.setAttribute('y2', toY);
    line.setAttribute('stroke', 'rgba(175,169,236,0.5)');
    line.setAttribute('stroke-width', '1');
    line.setAttribute('stroke-dasharray', '4 3');
    line.setAttribute('fill', 'none');
    line.setAttribute('marker-end', 'url(#arr)');
    dragEdgeLayer.appendChild(line);
  }

  function spawnPulse(x, y) {
    const circle = _svgEl('circle');
    circle.setAttribute('cx', x); circle.setAttribute('cy', y); circle.setAttribute('r', '0');
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', 'rgba(175,169,236,0.45)');
    circle.setAttribute('stroke-width', '1');
    pulseLayer.appendChild(circle);
    circle.animate(
      [{ r: '0', opacity: '0.7' }, { r: '52', opacity: '0' }],
      { duration: 300, easing: 'ease-out', fill: 'forwards' }
    ).onfinish = () => circle.remove();
  }

  function render() {
    renderEdges();
    renderNodes();
  }

  // ─── Node pointer events ─────────────────────────────────────────────────

  function _attachNodeEvents(g, node) {
    let downPt    = null;
    let startPos  = null;

    g.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.stopPropagation();
      downPt   = { x: e.clientX, y: e.clientY };
      startPos = { x: node.x, y: node.y };
      pointerMoved = false;

      dragging = {
        nodeId: node.id,
        startX: node.x, startY: node.y,
        pointerX: e.clientX, pointerY: e.clientY,
      };

      longPressTimer = setTimeout(() => {
        if (!pointerMoved) {
          edgeDrawing = { fromId: node.id, fromX: node.x, fromY: node.y };
          dragging    = null;
          svgEl.style.cursor = 'crosshair';
          renderDragEdge(node.x, node.y);
        }
      }, 380);
    });

    g.addEventListener('dblclick', e => {
      e.stopPropagation();
      clearTimeout(longPressTimer);
      NodeInput.openRename(node, () => onRedraw && onRedraw());
    });

    g.addEventListener('contextmenu', e => {
      e.preventDefault();
      clearTimeout(longPressTimer);
      CtxMenu.show(e.clientX, e.clientY, {
        renameLabel: 'rename',
        deleteLabel: 'delete node',
        onRename: () => NodeInput.openRename(node, () => onRedraw && onRedraw()),
        onDelete: () => { store.deleteNode(node.id); onRedraw && onRedraw(); },
      });
    });
  }

  // ─── Document-level pointer events ──────────────────────────────────────

  document.addEventListener('pointermove', e => {
    if (edgeDrawing) {
      renderDragEdge(svgPt(svgEl, e).x, svgPt(svgEl, e).y);
      return;
    }
    if (!dragging) return;
    const dx   = e.clientX - dragging.pointerX;
    const dy   = e.clientY - dragging.pointerY;
    const dist = Math.hypot(dx, dy);
    if (dist > 5) {
      pointerMoved = true;
      clearTimeout(longPressTimer);
      const node = store.state.nodes.find(n => n.id === dragging.nodeId);
      if (node) {
        store.moveNode(node.id, dragging.startX + dx, dragging.startY + dy);
        onRedraw && onRedraw();
      }
    }
  });

  document.addEventListener('pointerup', e => {
    clearTimeout(longPressTimer);

    if (edgeDrawing) {
      const pt     = svgPt(svgEl, e);
      const target = store.sessionNodes().find(n => {
        const r = nodeRadius(store.nodeCount(n.id));
        return Math.hypot(n.x - pt.x, n.y - pt.y) <= r + 6 && n.id !== edgeDrawing.fromId;
      });
      if (target) { store.addEdge(edgeDrawing.fromId, target.id); }
      edgeDrawing = null;
      svgEl.style.cursor = '';
      dragEdgeLayer.innerHTML = '';
      dragging = null;
      onRedraw && onRedraw();
      return;
    }

    if (dragging) {
      const dx   = e.clientX - dragging.pointerX;
      const dy   = e.clientY - dragging.pointerY;
      const dist = Math.hypot(dx, dy);
      if (dist < 5 && !pointerMoved) {
        const node = store.state.nodes.find(n => n.id === dragging.nodeId);
        if (node) {
          store.recordEvent(node.id);
          spawnPulse(node.x, node.y);
          onRedraw && onRedraw();
        }
      } else if (pointerMoved) {
        store.save();
      }
    }
    dragging = null;
  });

  // Double-click on empty canvas → create node
  svgEl.addEventListener('dblclick', e => {
    const pt = svgPt(svgEl, e);
    const hit = store.sessionNodes().find(n => Math.hypot(n.x - pt.x, n.y - pt.y) <= nodeRadius(store.nodeCount(n.id)) + 4);
    if (hit) return;
    NodeInput.openCreate(pt, () => onRedraw && onRedraw());
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function _svgEl(tag) { return document.createElementNS('http://www.w3.org/2000/svg', tag); }

  return { render, setRedrawHandler };
})();
