// SVG canvas: renders nodes, edges, drag-edge, pulses, and handles pointer events.
// Supports zoom (wheel / pinch) and pan (two-finger scroll / space-drag / middle-click).

const Canvas = (() => {
  const svgEl         = document.getElementById('svg');
  const viewportEl    = document.getElementById('viewport');
  const edgeLayer     = document.getElementById('edgeLayer');
  const nodeLayer     = document.getElementById('nodeLayer');
  const dragEdgeLayer = document.getElementById('dragEdgeLayer');
  const pulseLayer    = document.getElementById('pulseLayer');
  const hint          = document.getElementById('hint');

  // ─── Viewport Transform State ─────────────────────────────────────────────
  let vt = { x: 0, y: 0, scale: 1 };
  const MIN_SCALE = 0.15;
  const MAX_SCALE = 4.0;
  const ZOOM_SENSITIVITY = 0.0012;

  function applyTransform() {
    viewportEl.setAttribute(
      'transform',
      `translate(${vt.x},${vt.y}) scale(${vt.scale})`
    );
    // Update zoom indicator
    const indicator = document.getElementById('zoomLevel');
    if (indicator) indicator.textContent = Math.round(vt.scale * 100) + '%';
  }

  // Convert screen (clientX/Y) → canvas local coordinates
  function screenToCanvas(clientX, clientY) {
    const rect = svgEl.getBoundingClientRect();
    return {
      x: (clientX - rect.left - vt.x) / vt.scale,
      y: (clientY - rect.top  - vt.y) / vt.scale,
    };
  }

  function clampScale(s) {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
  }

  // Zoom around a focal point (screen coords)
  function zoomAt(clientX, clientY, delta) {
    const rect    = svgEl.getBoundingClientRect();
    const sx      = clientX - rect.left;
    const sy      = clientY - rect.top;
    const oldScale = vt.scale;
    const newScale = clampScale(oldScale * (1 + delta));
    const ratio   = newScale / oldScale;
    vt.x = sx - ratio * (sx - vt.x);
    vt.y = sy - ratio * (sy - vt.y);
    vt.scale = newScale;
    applyTransform();
  }

  function resetView() {
    vt = { x: 0, y: 0, scale: 1 };
    applyTransform();
  }

  // ─── Interaction State ────────────────────────────────────────────────────
  let dragging       = null;  // node drag
  let panning        = null;  // canvas pan { startX, startY, vtX, vtY }
  let edgeDrawing    = null;
  let longPressTimer = null;
  let pointerMoved   = false;
  let spaceDown      = false;

  let onRedraw = null;
  function setRedrawHandler(fn) { onRedraw = fn; }

  // ─── CSS variable helper ──────────────────────────────────────────────────
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

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
      line.setAttribute('stroke', cssVar('--edge'));
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
        ring.setAttribute('stroke', cssVar('--node-hot-stroke'));
        ring.setAttribute('stroke-opacity', '0.22');
        ring.setAttribute('stroke-width', '1');
        g.appendChild(ring);
      }

      const circle = _svgEl('circle');
      circle.setAttribute('cx', node.x); circle.setAttribute('cy', node.y);
      circle.setAttribute('r', r);
      circle.setAttribute('fill',   hot ? cssVar('--node-hot-fill')   : cssVar('--node-fill'));
      circle.setAttribute('stroke', hot ? cssVar('--node-hot-stroke') : cssVar('--node-stroke'));
      circle.setAttribute('stroke-width', hot ? '1.2' : '1');
      g.appendChild(circle);

      const { el: labelEl, labelBlockH } = buildNodeLabel(node.label, node.x, node.y, r, count > 0);
      g.appendChild(labelEl);

      if (count > 0) {
        const countEl = _svgEl('text');
        countEl.setAttribute('x', node.x);
        countEl.setAttribute('y', countTextY(node.y, labelBlockH));
        countEl.setAttribute('text-anchor', 'middle');
        countEl.setAttribute('dominant-baseline', 'central');
        countEl.setAttribute('fill',        hot ? cssVar('--node-count-hot') : cssVar('--node-count'));
        countEl.setAttribute('font-size',   COUNT_FONT);
        countEl.setAttribute('font-weight', '500');
        countEl.setAttribute('font-family', 'Inter, system-ui, sans-serif');
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
    line.setAttribute('stroke', cssVar('--node-hot-stroke'));
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
    circle.setAttribute('stroke', cssVar('--node-hot-stroke'));
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

  // ─── Wheel: Zoom + Pan ────────────────────────────────────────────────────

  svgEl.addEventListener('wheel', e => {
    e.preventDefault();

    // ctrlKey = pinch-to-zoom on trackpad; also treat pure vertical scroll as zoom
    if (e.ctrlKey) {
      // Pinch zoom
      zoomAt(e.clientX, e.clientY, -e.deltaY * ZOOM_SENSITIVITY * 8);
    } else {
      // Two-finger scroll / regular scroll = pan
      vt.x -= e.deltaX;
      vt.y -= e.deltaY;
      applyTransform();
    }
  }, { passive: false });

  // ─── Keyboard zoom shortcuts ──────────────────────────────────────────────

  document.addEventListener('keydown', e => {
    if (e.key === ' ') { spaceDown = true; svgEl.style.cursor = 'grab'; e.preventDefault(); }
    if ((e.metaKey || e.ctrlKey) && e.key === '=') { e.preventDefault(); zoomAt(svgEl.getBoundingClientRect().width/2, svgEl.getBoundingClientRect().height/2,  0.15); }
    if ((e.metaKey || e.ctrlKey) && e.key === '-') { e.preventDefault(); zoomAt(svgEl.getBoundingClientRect().width/2, svgEl.getBoundingClientRect().height/2, -0.15); }
    if ((e.metaKey || e.ctrlKey) && e.key === '0') { e.preventDefault(); resetView(); }
  });
  document.addEventListener('keyup', e => {
    if (e.key === ' ') { spaceDown = false; svgEl.style.cursor = ''; }
  });

  // ─── Zoom control buttons ─────────────────────────────────────────────────

  document.getElementById('zoomIn')?.addEventListener('click',  () => {
    const rect = svgEl.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 0.20);
  });
  document.getElementById('zoomOut')?.addEventListener('click', () => {
    const rect = svgEl.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, -0.20);
  });
  document.getElementById('zoomReset')?.addEventListener('click', resetView);

  // ─── Node pointer events ─────────────────────────────────────────────────

  function _attachNodeEvents(g, node) {
    g.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.stopPropagation();
      pointerMoved = false;

      // Space held = pan mode even on nodes
      if (spaceDown) {
        panning = { startX: e.clientX, startY: e.clientY, vtX: vt.x, vtY: vt.y };
        svgEl.style.cursor = 'grabbing';
        return;
      }

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
      const count = store.nodeCount(node.id);
      CtxMenu.show(e.clientX, e.clientY, {
        undoLabel:  count > 0 ? `undo click  (${count} → ${count - 1})` : null,
        onUndo: () => {
          const removed = store.undoEvent(node.id);
          if (removed && typeof FirebaseDB !== 'undefined') FirebaseDB.deleteEvent(removed.id);
          onRedraw && onRedraw();
        },
        renameLabel: 'rename',
        deleteLabel: 'delete node',
        onRename: () => NodeInput.openRename(node, () => onRedraw && onRedraw()),
        onDelete: () => { store.deleteNode(node.id); onRedraw && onRedraw(); },
      });
    });
  }

  // ─── SVG-level pointer: panning on empty canvas ──────────────────────────

  svgEl.addEventListener('pointerdown', e => {
    // Middle mouse button (button 1) = pan
    if (e.button === 1 || spaceDown) {
      e.preventDefault();
      panning = { startX: e.clientX, startY: e.clientY, vtX: vt.x, vtY: vt.y };
      svgEl.style.cursor = 'grabbing';
    }
  });

  // ─── Document-level pointer events ──────────────────────────────────────

  document.addEventListener('pointermove', e => {
    // Pan
    if (panning) {
      vt.x = panning.vtX + (e.clientX - panning.startX);
      vt.y = panning.vtY + (e.clientY - panning.startY);
      applyTransform();
      return;
    }

    // Edge drawing
    if (edgeDrawing) {
      const pt = screenToCanvas(e.clientX, e.clientY);
      renderDragEdge(pt.x, pt.y);
      return;
    }

    // Node drag
    if (!dragging) return;
    const dx   = e.clientX - dragging.pointerX;
    const dy   = e.clientY - dragging.pointerY;
    const dist = Math.hypot(dx, dy);
    if (dist > 5) {
      pointerMoved = true;
      clearTimeout(longPressTimer);
      const node = store.state.nodes.find(n => n.id === dragging.nodeId);
      if (node) {
        // Convert drag delta from screen → canvas scale
        store.moveNode(node.id, dragging.startX + dx / vt.scale, dragging.startY + dy / vt.scale);
        onRedraw && onRedraw();
      }
    }
  });

  document.addEventListener('pointerup', e => {
    clearTimeout(longPressTimer);

    if (panning) {
      panning = null;
      svgEl.style.cursor = spaceDown ? 'grab' : '';
      return;
    }

    if (edgeDrawing) {
      const pt     = screenToCanvas(e.clientX, e.clientY);
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
    if (spaceDown) return;
    const pt  = screenToCanvas(e.clientX, e.clientY);
    const hit = store.sessionNodes().find(n =>
      Math.hypot(n.x - pt.x, n.y - pt.y) <= nodeRadius(store.nodeCount(n.id)) + 4
    );
    if (hit) return;
    NodeInput.openCreate(pt, () => onRedraw && onRedraw());
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function _svgEl(tag) { return document.createElementNS('http://www.w3.org/2000/svg', tag); }

  return { render, setRedrawHandler, resetView };
})();
