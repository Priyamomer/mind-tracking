// Shared utility functions available globally in the renderer.

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function svgPt(svgEl, e) {
  const rect = svgEl.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function nodeRadius(count) {
  return Math.min(20 + count * 2, 46);
}

// Naive word-wrap for SVG text given an approximate max pixel width.
function wrapText(text, maxWidth) {
  const CHAR_W = 5.8;
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? current + ' ' + word : word;
    if (test.length * CHAR_W > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

const COUNT_FONT   = 14;
const COUNT_GAP    = 6;
const LINE_HEIGHT  = 13;
const LABEL_FONT   = 10;

function buildNodeLabel(text, cx, cy, r, hasCount) {
  const maxWidth = r * 1.7;
  const lines = wrapText(text, maxWidth);
  const labelBlockH = lines.length * LINE_HEIGHT;

  let labelTopY;
  if (hasCount) {
    const totalH = labelBlockH + COUNT_GAP + COUNT_FONT;
    labelTopY = cy - totalH / 2 + LINE_HEIGHT / 2;
  } else {
    labelTopY = cy - labelBlockH / 2 + LINE_HEIGHT / 2;
  }

  const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  textEl.setAttribute('text-anchor', 'middle');
  textEl.setAttribute('fill', 'rgba(255,255,255,0.5)');
  textEl.setAttribute('font-size', LABEL_FONT);
  textEl.setAttribute('font-family', 'system-ui, sans-serif');

  lines.forEach((line, i) => {
    const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
    tspan.setAttribute('x', cx);
    tspan.setAttribute('y', labelTopY + i * LINE_HEIGHT);
    tspan.setAttribute('dominant-baseline', 'central');
    tspan.textContent = line;
    textEl.appendChild(tspan);
  });

  return { el: textEl, labelBlockH };
}

function countTextY(cy, labelBlockH) {
  const totalH = labelBlockH + COUNT_GAP + COUNT_FONT;
  return cy - totalH / 2 + labelBlockH + COUNT_GAP + COUNT_FONT / 2;
}
