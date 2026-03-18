/**
 * Photolina – Photoshop-like image editor
 * Black & Neon Lime | No login, free forever
 */

(function () {
  'use strict';

  const NEON = '#059669';
  const MAX_HISTORY = 30;

  let canvas, ctx, container, selectionCanvas, selectionCtx;
  let layers = [];
  let activeLayerIndex = 0;
  let tool = 'cursor';
  let isDrawing = false;
  let lastX = 0, lastY = 0;
  let brushSize = 10;
  let opacity = 1;
  let strokeColor = NEON;
  let zoom = 1;
  let panX = 0, panY = 0;
  let history = [];
  let historyIndex = -1;
  let selection = null;
  let startX, startY;
  let selectionDragMode = null;
  let selectionResizeHandle = null;
  let startSelection = null;
  const HANDLE = 10;
  let activeTextBox = null;
  let textBoxDragMode = null;
  let textBoxResizeHandle = null;
  let startTextBox = null;
  let restoreSource = null;
  let textSize = 24;
  let fillTolerance = 40;
  let brushHardness = 1;

  function $(id) { return document.getElementById(id); }
  function byClass(c) { return document.querySelectorAll(c); }

  function createLayer(w, h, name) {
    const el = document.createElement('canvas');
    el.width = w;
    el.height = h;
    const ctx = el.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    return {
      canvas: el,
      ctx,
      name: name != null && name !== '' ? name : getNextLayerName(),
      visible: true,
      offsetX: 0,
      offsetY: 0
    };
  }

  function addLayer(w, h, name) {
    if (!w || !h) return;
    const layer = createLayer(w, h, name);
    layers.push(layer);
    activeLayerIndex = layers.length - 1;
    renderLayerList();
    composite();
    saveHistory();
  }

  function getDocSize() {
    if (layers.length === 0) return { w: 0, h: 0 };
    return { w: layers[0].canvas.width, h: layers[0].canvas.height };
  }

  function getNextLayerName() {
    return layers.length === 0 ? 'Original' : String(layers.length + 1);
  }

  function composite() {
    if (!canvas || layers.length === 0) return;
    const { w, h } = getDocSize();
    canvas.width = w;
    canvas.height = h;
    if (selectionCanvas) {
      selectionCanvas.width = w;
      selectionCanvas.height = h;
      selectionCanvas.style.width = canvas.width + 'px';
      selectionCanvas.style.height = canvas.height + 'px';
    }
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, w, h);
    layers.forEach(l => {
      if (!l.visible) return;
      c.globalAlpha = 1;
      c.drawImage(l.canvas, 0, 0, l.canvas.width, l.canvas.height, l.offsetX, l.offsetY, l.canvas.width, l.canvas.height);
    });
    c.globalAlpha = 1;
    drawSelection();
  }

  function hitTestSelection(px, py) {
    if (!selection || selection.w <= 0 || selection.h <= 0) return null;
    const { x, y, w, h } = selection;
    const H = HANDLE;
    if (px >= x && px <= x + w && py >= y && py <= y + h) {
      const inLeft = px <= x + H, inRight = px >= x + w - H;
      const inTop = py <= y + H, inBottom = py >= y + h - H;
      if (inTop && inLeft) return 'nw';
      if (inTop && inRight) return 'ne';
      if (inBottom && inLeft) return 'sw';
      if (inBottom && inRight) return 'se';
      if (inTop) return 'n';
      if (inBottom) return 's';
      if (inLeft) return 'w';
      if (inRight) return 'e';
      return 'inside';
    }
    return null;
  }

  function drawSelection() {
    if (!selectionCanvas || !selectionCtx) return;
    selectionCtx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
    if (selection && selection.w > 0 && selection.h > 0) {
      const { x, y, w, h } = selection;
      selectionCtx.strokeStyle = NEON;
      selectionCtx.lineWidth = 2;
      selectionCtx.setLineDash([6, 4]);
      selectionCtx.strokeRect(x, y, w, h);
      selectionCtx.fillStyle = 'rgba(5, 150, 105, 0.08)';
      selectionCtx.fillRect(x, y, w, h);
      selectionCtx.setLineDash([]);
      selectionCtx.fillStyle = NEON;
      const H = HANDLE;
      [[x, y], [x + w - H, y], [x + w - H, y + h - H], [x, y + h - H],
       [x + w/2 - H/2, y], [x + w/2 - H/2, y + h - H], [x, y + h/2 - H/2], [x + w - H, y + h/2 - H/2]].forEach(([bx, by]) => {
        selectionCtx.fillRect(bx, by, H, H);
      });
    }
    if (tool === 'text' && activeTextBox && selectionCanvas && selectionCtx) {
      const { x, y, w, h } = activeTextBox;
      selectionCtx.strokeStyle = NEON;
      selectionCtx.lineWidth = 2;
      selectionCtx.setLineDash([4, 4]);
      selectionCtx.strokeRect(x, y, w, h);
      selectionCtx.setLineDash([]);
      selectionCtx.fillStyle = 'rgba(5, 150, 105, 0.06)';
      selectionCtx.fillRect(x, y, w, h);
      const text = ($('text-input') && $('text-input').value) ? $('text-input').value : 'Text';
      const fontSize = parseInt($('text-size') && $('text-size').value, 10) || 24;
      const fontFamily = ($('text-font') && $('text-font').value) || 'Outfit, sans-serif';
      const color = ($('text-color') && $('text-color').value) || strokeColor;
      selectionCtx.font = `${fontSize}px ${fontFamily}`;
      selectionCtx.fillStyle = color;
      selectionCtx.textBaseline = 'top';
      selectionCtx.fillText(text, x + 4, y + 4, w - 8);
      selectionCtx.fillStyle = NEON;
      [[x, y], [x + w - H, y], [x + w - H, y + h - H], [x, y + h - H],
       [x + w/2 - H/2, y], [x + w/2 - H/2, y + h - H], [x, y + h/2 - H/2], [x + w - H, y + h/2 - H/2]].forEach(([bx, by]) => {
        selectionCtx.fillRect(bx, by, H, H);
      });
    }
  }

  function hitTestTextBox(px, py) {
    if (!activeTextBox) return null;
    const { x, y, w, h } = activeTextBox;
    const H = HANDLE;
    if (px >= x && px <= x + w && py >= y && py <= y + h) {
      const inLeft = px <= x + H, inRight = px >= x + w - H;
      const inTop = py <= y + H, inBottom = py >= y + h - H;
      if (inTop && inLeft) return 'nw';
      if (inTop && inRight) return 'ne';
      if (inBottom && inLeft) return 'sw';
      if (inBottom && inRight) return 'se';
      if (inTop) return 'n';
      if (inBottom) return 's';
      if (inLeft) return 'w';
      if (inRight) return 'e';
      return 'inside';
    }
    return null;
  }

  function renderLayerList() {
    const list = $('layer-list');
    list.innerHTML = '';
    layers.forEach((l, i) => {
      const div = document.createElement('div');
      div.className = 'layer-item' + (i === activeLayerIndex ? ' active' : '');
      div.dataset.index = i;
      div.innerHTML = `
        <span class="layer-eye" data-action="toggle" title="Toggle visibility">${l.visible ? '👁' : '👁‍🗨'}</span>
        <span class="layer-name" title="${l.name}">${l.name}</span>
      `;
      div.addEventListener('click', (e) => {
        if (e.target.classList.contains('layer-eye')) {
          l.visible = !l.visible;
          renderLayerList();
          composite();
          return;
        }
        activeLayerIndex = i;
        renderLayerList();
        composite();
      });
      list.appendChild(div);
    });
  }

  function saveHistory() {
    const state = layers.map(l => {
      const c = document.createElement('canvas');
      c.width = l.canvas.width;
      c.height = l.canvas.height;
      c.getContext('2d').drawImage(l.canvas, 0, 0);
      return { canvas: c, offsetX: l.offsetX, offsetY: l.offsetY };
    });
    if (historyIndex < history.length - 1) history.splice(historyIndex + 1);
    history.push(state);
    if (history.length > MAX_HISTORY) {
      history.shift();
      historyIndex = history.length - 1;
    } else {
      historyIndex++;
    }
    updateUndoRedoButtons();
  }

  function undo() {
    if (historyIndex <= 0) return;
    historyIndex--;
    restoreHistory();
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    restoreHistory();
  }

  function restoreHistory() {
    const state = history[historyIndex];
    if (!state) return;
    while (layers.length > state.length) layers.pop();
    state.forEach((entry, i) => {
      const c = entry.canvas || entry;
      if (!layers[i]) {
        const name = i === 0 ? 'Original' : String(i + 1);
        const l = createLayer(c.width, c.height, name);
        l.ctx.drawImage(c, 0, 0);
        if (entry.offsetX !== undefined) l.offsetX = entry.offsetX;
        if (entry.offsetY !== undefined) l.offsetY = entry.offsetY;
        layers.push(l);
      } else {
        const l = layers[i];
        if (l.canvas.width !== c.width || l.canvas.height !== c.height) {
          l.canvas.width = c.width;
          l.canvas.height = c.height;
          l.ctx = l.canvas.getContext('2d');
        }
        l.ctx.clearRect(0, 0, l.canvas.width, l.canvas.height);
        l.ctx.drawImage(c, 0, 0);
        if (entry.offsetX !== undefined) l.offsetX = entry.offsetX;
        if (entry.offsetY !== undefined) l.offsetY = entry.offsetY;
      }
    });
    activeLayerIndex = Math.min(activeLayerIndex, layers.length - 1);
    if (activeLayerIndex < 0) activeLayerIndex = 0;
    composite();
    renderLayerList();
    updateUndoRedoButtons();
    const { w, h } = getDocSize();
    if (w && h) {
      $('status-size').textContent = `${w} × ${h}`;
      updateImagePanelSize();
    }
  }

  function updateUndoRedoButtons() {
    const undoBtn = $('header-undo-btn');
    const redoBtn = $('header-redo-btn');
    if (undoBtn) undoBtn.disabled = historyIndex <= 0 || history.length === 0;
    if (redoBtn) redoBtn.disabled = historyIndex >= history.length - 1 || history.length === 0;
  }

  function hasDocument() {
    return layers.length > 0 && getDocSize().w > 0 && getDocSize().h > 0;
  }

  function screenToCanvas(clientX, clientY) {
    if (!container || !canvas) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    const cw = canvas.width;
    const ch = canvas.height;
    if (!cw || !ch) return { x: 0, y: 0 };
    const x = ((clientX - rect.left) / rect.width) * cw;
    const y = ((clientY - rect.top) / rect.height) * ch;
    return { x: Math.round(x), y: Math.round(y) };
  }

  function getActiveLayer() {
    return layers[activeLayerIndex];
  }

  function drawBrush(x, y) {
    const layer = getActiveLayer();
    if (!layer || !layer.visible) return;
    const l = layer.ctx;
    const r = brushSize / 2;
    if (brushHardness >= 1) {
      l.globalAlpha = opacity;
      l.fillStyle = strokeColor;
      l.beginPath();
      l.arc(x, y, r, 0, Math.PI * 2);
      l.fill();
    } else {
      const grad = l.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, strokeColor);
      grad.addColorStop(Math.max(0, 1 - brushHardness), strokeColor);
      grad.addColorStop(1, 'transparent');
      l.globalAlpha = opacity;
      l.fillStyle = grad;
      l.fillRect(x - r, y - r, brushSize, brushSize);
    }
    l.globalAlpha = 1;
  }

  function drawEraser(x, y) {
    const layer = getActiveLayer();
    if (!layer || !layer.visible) return;
    layer.ctx.clearRect(x - brushSize / 2, y - brushSize / 2, brushSize, brushSize);
  }

  function fillAt(sx, sy) {
    const layer = getActiveLayer();
    if (!layer || !layer.visible) return;
    const { width: w, height: h } = layer.canvas;
    const imgData = layer.ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const start = (sy * w + sx) * 4;
    const r = data[start], g = data[start + 1], b = data[start + 2], a = data[start + 3];
    const hexToRgb = (hex) => {
      let h = hex.slice(1);
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      const n = parseInt(h, 16);
      return [n >> 16, (n >> 8) & 255, n & 255];
    };
    const [fr, fg, fb] = hexToRgb(strokeColor);
    const tol = Math.max(0, Math.min(255, fillTolerance));
    const stack = [[sx, sy]];
    const seen = new Set();
    seen.add(sx + sy * w);
    let count = 0;
    const maxPixels = w * h;
    while (stack.length && count < maxPixels) {
      const [px, py] = stack.pop();
      const i = (py * w + px) * 4;
      if (Math.abs(data[i] - r) <= tol && Math.abs(data[i + 1] - g) <= tol &&
          Math.abs(data[i + 2] - b) <= tol && Math.abs(data[i + 3] - a) <= tol) {
        data[i] = fr; data[i + 1] = fg; data[i + 2] = fb; data[i + 3] = 255 * opacity;
        count++;
        [[px+1,py],[px-1,py],[px,py+1],[px,py-1]].forEach(([nx, ny]) => {
          if (nx >= 0 && nx < w && ny >= 0 && ny < h && !seen.has(nx + ny * w)) {
            seen.add(nx + ny * w);
            stack.push([nx, ny]);
          }
        });
      }
    }
    layer.ctx.putImageData(imgData, 0, 0);
    composite();
    saveHistory();
  }

  function fillAtTransparent(sx, sy) {
    const layer = getActiveLayer();
    if (!layer || !layer.visible) return;
    const { width: w, height: h } = layer.canvas;
    const imgData = layer.ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const start = (sy * w + sx) * 4;
    const r = data[start], g = data[start + 1], b = data[start + 2], a = data[start + 3];
    const tol = Math.max(0, Math.min(255, fillTolerance));
    const stack = [[sx, sy]];
    const seen = new Set();
    seen.add(sx + sy * w);
    let count = 0;
    const maxPixels = w * h;
    while (stack.length && count < maxPixels) {
      const [px, py] = stack.pop();
      const i = (py * w + px) * 4;
      if (Math.abs(data[i] - r) <= tol && Math.abs(data[i + 1] - g) <= tol &&
          Math.abs(data[i + 2] - b) <= tol && Math.abs(data[i + 3] - a) <= tol) {
        data[i + 3] = 0;
        count++;
        [[px+1,py],[px-1,py],[px,py+1],[px,py-1]].forEach(([nx, ny]) => {
          if (nx >= 0 && nx < w && ny >= 0 && ny < h && !seen.has(nx + ny * w)) {
            seen.add(nx + ny * w);
            stack.push([nx, ny]);
          }
        });
      }
    }
    layer.ctx.putImageData(imgData, 0, 0);
    composite();
    saveHistory();
  }

  function drawMagicRestore(x, y) {
    const layer = getActiveLayer();
    if (!layer || !layer.visible || !restoreSource) return;
    if (layer.canvas.width !== restoreSource.width || layer.canvas.height !== restoreSource.height) return;
    const r = brushSize / 2;
    layer.ctx.save();
    layer.ctx.beginPath();
    layer.ctx.arc(x, y, r, 0, Math.PI * 2);
    layer.ctx.clip();
    layer.ctx.drawImage(restoreSource, x - r, y - r, 2 * r, 2 * r, x - r, y - r, 2 * r, 2 * r);
    layer.ctx.restore();
  }

  function getPixelColor(x, y) {
    const { w, h } = getDocSize();
    if (x < 0 || x >= w || y < 0 || y >= h) return strokeColor;
    for (let i = layers.length - 1; i >= 0; i--) {
      if (!layers[i].visible) continue;
      const d = layers[i].ctx.getImageData(x, y, 1, 1).data;
      if (d[3] > 0) {
        const r = d[0].toString(16).padStart(2, '0');
        const g = d[1].toString(16).padStart(2, '0');
        const b = d[2].toString(16).padStart(2, '0');
        return '#' + r + g + b;
      }
    }
    return strokeColor;
  }

  function drawShape(type, x1, y1, x2, y2) {
    const layer = getActiveLayer();
    if (!layer || !layer.visible) return;
    const l = layer.ctx;
    l.strokeStyle = strokeColor;
    l.fillStyle = strokeColor;
    l.globalAlpha = opacity;
    l.lineWidth = Math.max(1, Math.round(brushSize / 4));
    l.beginPath();
    if (type === 'rect') {
      const x = Math.min(x1, x2), y = Math.min(y1, y2);
      l.rect(x, y, Math.abs(x2 - x1), Math.abs(y2 - y1));
    } else if (type === 'ellipse') {
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
      const rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
      l.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    } else if (type === 'line') {
      l.moveTo(x1, y1);
      l.lineTo(x2, y2);
    }
    l.stroke();
    l.globalAlpha = 1;
    composite();
    saveHistory();
  }

  function addText(x, y) {
    const { w: docW, h: docH } = getDocSize();
    if (!docW || !docH) return;
    const hit = hitTestTextBox(x, y);
    if (hit === 'inside') {
      textBoxDragMode = 'move';
      startTextBox = { x: activeTextBox.x, y: activeTextBox.y, w: activeTextBox.w, h: activeTextBox.h };
    } else if (hit && hit !== 'inside') {
      textBoxDragMode = 'resize';
      textBoxResizeHandle = hit;
      startTextBox = { x: activeTextBox.x, y: activeTextBox.y, w: activeTextBox.w, h: activeTextBox.h };
    } else {
      activeTextBox = { x: Math.max(0, x), y: Math.max(0, y), w: 200, h: 50 };
      drawSelection();
    }
  }

  function applyTextToLayer() {
    if (!activeTextBox || !hasDocument()) return;
    const text = ($('text-input') && $('text-input').value) ? $('text-input').value.trim() : '';
    if (!text) return;
    const layer = getActiveLayer();
    if (!layer) return;
    const fontSize = parseInt($('text-size') && $('text-size').value, 10) || 24;
    const fontFamily = ($('text-font') && $('text-font').value) || 'Outfit, sans-serif';
    const color = ($('text-color') && $('text-color').value) || strokeColor;
    layer.ctx.font = `${fontSize}px ${fontFamily}`;
    layer.ctx.fillStyle = color;
    layer.ctx.textBaseline = 'top';
    layer.ctx.fillText(text, activeTextBox.x + 4, activeTextBox.y + 4, activeTextBox.w - 8);
    activeTextBox = null;
    textBoxDragMode = null;
    textBoxResizeHandle = null;
    startTextBox = null;
    composite();
    drawSelection();
    saveHistory();
  }

  function initDoc(width, height) {
    layers = [];
    history = [];
    historyIndex = -1;
    addLayer(width, height, 'Original');
    composite();
    renderLayerList();
    saveHistory();
    $('status-size').textContent = `${width} × ${height}`;
    updateImagePanelSize();
    const wel = $('welcome-state');
    if (wel) wel.classList.add('hidden');
  }

  function openImage(file) {
    const img = new Image();
    img.onload = () => {
      initDoc(img.width, img.height);
      getActiveLayer().ctx.drawImage(img, 0, 0);
      composite();
      saveHistory();
      updateImagePanelSize();
    };
    img.src = URL.createObjectURL(file);
  }

  function removeBackground() {
    if (!hasDocument()) return;
    const layer = getActiveLayer();
    if (!layer) return;
    const w = layer.canvas.width, h = layer.canvas.height;
    restoreSource = document.createElement('canvas');
    restoreSource.width = w;
    restoreSource.height = h;
    restoreSource.getContext('2d').drawImage(layer.canvas, 0, 0);
    const imgData = layer.ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const tol = 60;
    const sample = (x, y) => {
      const i = (y * w + x) * 4;
      return [data[i], data[i + 1], data[i + 2], data[i + 3]];
    };
    const corners = [
      sample(0, 0), sample(w - 1, 0), sample(0, h - 1), sample(w - 1, h - 1),
      sample(Math.floor(w / 2), 0), sample(0, Math.floor(h / 2)), sample(w - 1, Math.floor(h / 2)), sample(Math.floor(w / 2), h - 1)
    ];
    let br = 0, bg = 0, bb = 0, n = 0;
    corners.forEach(([r, g, b]) => { br += r; bg += g; bb += b; n++; });
    br = Math.round(br / n); bg = Math.round(bg / n); bb = Math.round(bb / n);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (Math.abs(r - br) <= tol && Math.abs(g - bg) <= tol && Math.abs(b - bb) <= tol) {
        data[i + 3] = 0;
      }
    }
    layer.ctx.putImageData(imgData, 0, 0);
    composite();
    saveHistory();
  }

  function savePNG() {
    if (layers.length === 0) return;
    composite();
    const link = document.createElement('a');
    link.download = 'photolina.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function saveJPG() {
    if (layers.length === 0) return;
    composite();
    const link = document.createElement('a');
    link.download = 'photolina.jpg';
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    link.click();
  }

  function applyToActiveLayer(fn) {
    if (!hasDocument()) return;
    const layer = getActiveLayer();
    if (!layer) return;
    const w = layer.canvas.width, h = layer.canvas.height;
    const imgData = layer.ctx.getImageData(0, 0, w, h);
    fn(imgData);
    layer.ctx.putImageData(imgData, 0, 0);
    composite();
    saveHistory();
  }

  function adjustBrightnessContrast(imgData, brightness, contrast) {
    const d = imgData.data;
    const f = (contrast / 100) * 1.2;
    const b = (brightness - 100) * 2.55;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.max(0, Math.min(255, (d[i] - 128) * f + 128 + b));
      d[i + 1] = Math.max(0, Math.min(255, (d[i + 1] - 128) * f + 128 + b));
      d[i + 2] = Math.max(0, Math.min(255, (d[i + 2] - 128) * f + 128 + b));
    }
  }

  function adjustSaturation(imgData, sat) {
    const d = imgData.data;
    const s = sat / 100;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const gray = 0.2989 * r + 0.587 * g + 0.114 * b;
      d[i] = Math.max(0, Math.min(255, gray + (r - gray) * s));
      d[i + 1] = Math.max(0, Math.min(255, gray + (g - gray) * s));
      d[i + 2] = Math.max(0, Math.min(255, gray + (b - gray) * s));
    }
  }

  function invert(imgData) {
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255 - d[i];
      d[i + 1] = 255 - d[i + 1];
      d[i + 2] = 255 - d[i + 2];
    }
  }

  function grayscale(imgData) {
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = g;
    }
  }

  function blur(imgData, radius) {
    const w = imgData.width, h = imgData.height;
    const d = imgData.data;
    const out = new Uint8ClampedArray(d.length);
    const r = Math.max(1, Math.floor(radius));
    const size = (r * 2 + 1) ** 2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sr = 0, sg = 0, sb = 0, sa = 0, n = 0;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              const i = (ny * w + nx) * 4;
              sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; sa += d[i + 3];
              n++;
            }
          }
        }
        const i = (y * w + x) * 4;
        out[i] = sr / n; out[i + 1] = sg / n; out[i + 2] = sb / n; out[i + 3] = sa / n;
      }
    }
    for (let i = 0; i < d.length; i++) d[i] = out[i];
  }

  function flipHorizontal(imgData) {
    const w = imgData.width, h = imgData.height;
    const d = imgData.data;
    const row = new Uint8ClampedArray(w * 4);
    for (let y = 0; y < h; y++) {
      const off = y * w * 4;
      for (let x = 0; x < w; x++) {
        const i = off + x * 4;
        row[x * 4] = d[i]; row[x * 4 + 1] = d[i + 1];
        row[x * 4 + 2] = d[i + 2]; row[x * 4 + 3] = d[i + 3];
      }
      for (let x = 0; x < w; x++) {
        const src = (w - 1 - x) * 4;
        d[off + x * 4] = row[src]; d[off + x * 4 + 1] = row[src + 1];
        d[off + x * 4 + 2] = row[src + 2]; d[off + x * 4 + 3] = row[src + 3];
      }
    }
  }

  function flipVertical(imgData) {
    const w = imgData.width, h = imgData.height;
    const d = imgData.data;
    const tmp = new Uint8ClampedArray(d.length);
    tmp.set(d);
    for (let y = 0; y < h; y++) {
      const src = (h - 1 - y) * w * 4;
      const dst = y * w * 4;
      for (let x = 0; x < w * 4; x++) d[dst + x] = tmp[src + x];
    }
  }

  function setStatus(msg) {
    const el = $('status-coords') || $('status-size');
    if (el) el.textContent = msg;
  }

  function cropToSelection() {
    if (!selection || layers.length === 0) {
      setStatus('Draw a selection first (Select tool)');
      return;
    }
    if (selection.w <= 0 || selection.h <= 0) {
      setStatus('Draw a selection first (Select tool)');
      return;
    }
    const { x, y, w, h } = selection;
    composite();
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = w;
    cropCanvas.height = h;
    const cropCtx = cropCanvas.getContext('2d');
    cropCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
    const newLayer = createLayer(w, h, 'Original');
    newLayer.ctx.drawImage(cropCanvas, 0, 0);
    layers = [newLayer];
    activeLayerIndex = 0;
    selection = null;
    composite();
    drawSelection();
    renderLayerList();
    saveHistory();
    $('status-size').textContent = `${w} × ${h}`;
    setStatus('');
    updateImagePanelSize();
  }

  function updateImagePanelSize() {
    const { w, h } = getDocSize();
    const rw = $('resize-width');
    const rh = $('resize-height');
    const qi = $('quality-info');
    if (rw) rw.value = w || '';
    if (rh) rh.value = h || '';
    if (qi) qi.textContent = (w && h) ? `${w} × ${h} px` : '—';
  }

  function resizeDocument(newW, newH) {
    if (!hasDocument() || newW < 1 || newH < 1) return;
    const { w: oldW, h: oldH } = getDocSize();
    const scaleX = newW / oldW;
    const scaleY = newH / oldH;
    layers.forEach((layer, i) => {
      const lw = layer.canvas.width;
      const lh = layer.canvas.height;
      const nw = i === 0 ? newW : Math.max(1, Math.round(lw * scaleX));
      const nh = i === 0 ? newH : Math.max(1, Math.round(lh * scaleY));
      const c = document.createElement('canvas');
      c.width = nw;
      c.height = nh;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(layer.canvas, 0, 0, lw, lh, 0, 0, nw, nh);
      layer.canvas.width = nw;
      layer.canvas.height = nh;
      layer.ctx.drawImage(c, 0, 0);
      layer.offsetX = i === 0 ? 0 : Math.round(layer.offsetX * scaleX);
      layer.offsetY = i === 0 ? 0 : Math.round(layer.offsetY * scaleY);
    });
    composite();
    renderLayerList();
    saveHistory();
    $('status-size').textContent = `${newW} × ${newH}`;
    updateImagePanelSize();
  }

  function pixelateByBlockSize(imgData, blockPx) {
    if (blockPx < 1) return;
    const w = imgData.width, h = imgData.height;
    const d = imgData.data;
    const block = Math.min(blockPx, w, h);
    for (let y = 0; y < h; y += block) {
      for (let x = 0; x < w; x += block) {
        let sr = 0, sg = 0, sb = 0, sa = 0, n = 0;
        for (let dy = 0; dy < block && y + dy < h; dy++) {
          for (let dx = 0; dx < block && x + dx < w; dx++) {
            const i = ((y + dy) * w + (x + dx)) * 4;
            sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; sa += d[i + 3];
            n++;
          }
        }
        if (n === 0) continue;
        const r = Math.round(sr / n), g = Math.round(sg / n), b = Math.round(sb / n), a = Math.round(sa / n);
        for (let dy = 0; dy < block && y + dy < h; dy++) {
          for (let dx = 0; dx < block && x + dx < w; dx++) {
            const i = ((y + dy) * w + (x + dx)) * 4;
            d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
          }
        }
      }
    }
  }

  function copySelectionAsLayer() {
    if (!selection || layers.length === 0) {
      setStatus('Draw a selection first (Select tool)');
      return;
    }
    if (selection.w <= 0 || selection.h <= 0) {
      setStatus('Draw a selection first (Select tool)');
      return;
    }
    composite();
    const { x, y, w, h } = selection;
    const newLayer = createLayer(w, h, getNextLayerName());
    newLayer.ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
    newLayer.offsetX = x;
    newLayer.offsetY = y;
    layers.push(newLayer);
    activeLayerIndex = layers.length - 1;
    selection = null;
    drawSelection();
    renderLayerList();
    composite();
    saveHistory();
  }

  function showNewDocModal() {
    $('new-doc-modal').classList.add('open');
    $('new-width').value = 800;
    $('new-height').value = 600;
  }

  function showAdjustModal(title, label1, min1, max1, val1, label2, min2, max2, val2, callback) {
    const modal = $('adjust-modal');
    $('adjust-modal-title').textContent = title;
    $('adjust-label-1').textContent = label1;
    $('adjust-slider-1').min = min1; $('adjust-slider-1').max = max1; $('adjust-slider-1').value = val1;
    $('adjust-value-1').textContent = val1;
    const g2 = $('adjust-group-2');
    if (label2) {
      g2.style.display = 'block';
      $('adjust-label-2').textContent = label2;
      $('adjust-slider-2').min = min2; $('adjust-slider-2').max = max2; $('adjust-slider-2').value = val2;
      $('adjust-value-2').textContent = val2;
    } else g2.style.display = 'none';
    modal._callback = callback;
    modal.classList.add('open');
  }

  function setupUI() {
    canvas = $('main-canvas');
    ctx = canvas.getContext('2d');
    container = $('canvas-container');
    selectionCanvas = $('selection-canvas');
    selectionCtx = selectionCanvas ? selectionCanvas.getContext('2d') : null;

    byClass('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        byClass('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        tool = btn.dataset.tool;
        $('text-input-group').style.display = tool === 'text' ? 'block' : 'none';
        if (container) container.classList.toggle('move-tool', tool === 'move');
        drawSelection();
      });
    });


    container.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      const { w, h } = getDocSize();
      if (x < 0 || x >= w || y < 0 || y >= h) return;
      startX = x; startY = y; lastX = x; lastY = y;

      if (tool === 'cursor') {
        // Navigate and select only — no canvas action
      } else if (tool === 'move') {
        isDrawing = true;
        startX = x;
        startY = y;
      } else if (tool === 'brush' || tool === 'eraser' || tool === 'magicrestore') {
        isDrawing = true;
        if (tool === 'brush') drawBrush(x, y);
        else if (tool === 'eraser') drawEraser(x, y);
        else drawMagicRestore(x, y);
        composite();
      } else if (tool === 'fill') {
        fillAt(x, y);
      } else if (tool === 'filltransparent') {
        fillAtTransparent(x, y);
      } else if (tool === 'eyedropper') {
        strokeColor = getPixelColor(x, y);
        $('stroke-color').value = strokeColor;
        $('stroke-color-hex').value = strokeColor;
      } else if (tool === 'rect' || tool === 'ellipse' || tool === 'line') {
        isDrawing = true;
      } else if (tool === 'text') {
        addText(x, y);
      } else if (tool === 'select' || tool === 'crop') {
        const hit = hitTestSelection(x, y);
        if (hit === 'inside') {
          selectionDragMode = 'move';
          startSelection = { x: selection.x, y: selection.y, w: selection.w, h: selection.h };
        } else if (hit && hit !== 'inside') {
          selectionDragMode = 'resize';
          selectionResizeHandle = hit;
          startSelection = { x: selection.x, y: selection.y, w: selection.w, h: selection.h };
        } else {
          selection = null;
          isDrawing = true;
        }
      }
    });

    container.addEventListener('mousemove', (e) => {
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      $('status-coords').textContent = `${x}, ${y}`;

      if (isDrawing) {
        if (tool === 'move') {
          const layer = getActiveLayer();
          if (layer) {
            const dx = x - lastX, dy = y - lastY;
            layer.offsetX += dx;
            layer.offsetY += dy;
            composite();
          }
        } else if (tool === 'brush') {
          drawBrush(x, y);
          composite();
        } else if (tool === 'eraser') {
          drawEraser(x, y);
          composite();
        } else if (tool === 'magicrestore') {
          drawMagicRestore(x, y);
          composite();
        } else if (tool === 'rect' || tool === 'ellipse' || tool === 'line') {
          composite();
          ctx.strokeStyle = strokeColor;
          ctx.globalAlpha = opacity;
          ctx.lineWidth = Math.max(1, Math.round(brushSize / 4));
          ctx.setLineDash([4, 4]);
          if (tool === 'rect') ctx.strokeRect(Math.min(startX, x), Math.min(startY, y), Math.abs(x - startX), Math.abs(y - startY));
          else if (tool === 'ellipse') {
            const cx = (startX + x) / 2, cy = (startY + y) / 2;
            ctx.beginPath();
            ctx.ellipse(cx, cy, Math.abs(x - startX) / 2, Math.abs(y - startY) / 2, 0, 0, Math.PI * 2);
            ctx.stroke();
          } else if (tool === 'line') {
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(x, y);
            ctx.stroke();
          }
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        } else if (tool === 'select' || tool === 'crop') {
          selection = {
            x: Math.min(startX, x),
            y: Math.min(startY, y),
            w: Math.max(1, Math.abs(x - startX)),
            h: Math.max(1, Math.abs(y - startY))
          };
          drawSelection();
        }
      } else if (selectionDragMode === 'move' && startSelection) {
        const dx = x - startX, dy = y - startY;
        const { w, h } = getDocSize();
        selection = {
          x: Math.max(0, Math.min(w - startSelection.w, startSelection.x + dx)),
          y: Math.max(0, Math.min(h - startSelection.h, startSelection.y + dy)),
          w: startSelection.w,
          h: startSelection.h
        };
        drawSelection();
      } else if (selectionDragMode === 'resize' && startSelection && selectionResizeHandle) {
        const { w: docW, h: docH } = getDocSize();
        let nx = startSelection.x, ny = startSelection.y, nw = startSelection.w, nh = startSelection.h;
        const handle = selectionResizeHandle;
        if (handle === 'e' || handle === 'se' || handle === 'ne') nw = Math.max(1, x - startSelection.x);
        if (handle === 'w' || handle === 'sw' || handle === 'nw') {
          nx = Math.min(x, startSelection.x + startSelection.w - 1);
          nw = Math.max(1, startSelection.x + startSelection.w - nx);
        }
        if (handle === 's' || handle === 'se' || handle === 'sw') nh = Math.max(1, y - startSelection.y);
        if (handle === 'n' || handle === 'nw' || handle === 'ne') {
          ny = Math.min(y, startSelection.y + startSelection.h - 1);
          nh = Math.max(1, startSelection.y + startSelection.h - ny);
        }
        nx = Math.max(0, Math.min(docW - 1, nx));
        ny = Math.max(0, Math.min(docH - 1, ny));
        nw = Math.max(1, Math.min(docW - nx, nw));
        nh = Math.max(1, Math.min(docH - ny, nh));
        selection = { x: nx, y: ny, w: nw, h: nh };
        drawSelection();
      } else if (textBoxDragMode === 'move' && startTextBox) {
        const dx = x - startX, dy = y - startY;
        const { w: docW, h: docH } = getDocSize();
        activeTextBox = {
          x: Math.max(0, Math.min(docW - startTextBox.w, startTextBox.x + dx)),
          y: Math.max(0, Math.min(docH - startTextBox.h, startTextBox.y + dy)),
          w: startTextBox.w,
          h: startTextBox.h
        };
        drawSelection();
      } else if (textBoxDragMode === 'resize' && startTextBox && textBoxResizeHandle) {
        const { w: docW, h: docH } = getDocSize();
        let nx = startTextBox.x, ny = startTextBox.y, nw = startTextBox.w, nh = startTextBox.h;
        const handle = textBoxResizeHandle;
        if (handle === 'e' || handle === 'se' || handle === 'ne') nw = Math.max(20, x - startTextBox.x);
        if (handle === 'w' || handle === 'sw' || handle === 'nw') {
          nx = Math.min(x, startTextBox.x + startTextBox.w - 20);
          nw = Math.max(20, startTextBox.x + startTextBox.w - nx);
        }
        if (handle === 's' || handle === 'se' || handle === 'sw') nh = Math.max(20, y - startTextBox.y);
        if (handle === 'n' || handle === 'nw' || handle === 'ne') {
          ny = Math.min(y, startTextBox.y + startTextBox.h - 20);
          nh = Math.max(20, startTextBox.y + startTextBox.h - ny);
        }
        nx = Math.max(0, Math.min(docW - 20, nx));
        ny = Math.max(0, Math.min(docH - 20, ny));
        nw = Math.max(20, Math.min(docW - nx, nw));
        nh = Math.max(20, Math.min(docH - ny, nh));
        activeTextBox = { x: nx, y: ny, w: nw, h: nh };
        drawSelection();
      }
      lastX = x; lastY = y;
    });

    container.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return;
      if (isDrawing && (tool === 'rect' || tool === 'ellipse' || tool === 'line')) {
        const { x, y } = screenToCanvas(e.clientX, e.clientY);
        drawShape(tool, startX, startY, x, y);
      }
      isDrawing = false;
      selectionDragMode = null;
      selectionResizeHandle = null;
      startSelection = null;
      textBoxDragMode = null;
      textBoxResizeHandle = null;
      startTextBox = null;
    });

    container.addEventListener('mouseleave', () => {
      isDrawing = false;
      selectionDragMode = null;
      selectionResizeHandle = null;
      startSelection = null;
      textBoxDragMode = null;
      textBoxResizeHandle = null;
      startTextBox = null;
    });

    const fillTolEl = $('fill-tolerance');
    if (fillTolEl) {
      fillTolEl.addEventListener('input', () => {
        fillTolerance = +fillTolEl.value;
        const v = $('fill-tolerance-value');
        if (v) v.textContent = fillTolerance;
      });
    }
    $('brush-size').addEventListener('input', () => {
      brushSize = +$('brush-size').value;
      $('brush-size-value').textContent = brushSize;
    });
    const brushHardEl = $('brush-hardness');
    if (brushHardEl) {
      brushHardEl.addEventListener('input', () => {
        brushHardness = +brushHardEl.value / 100;
        const v = $('brush-hardness-value');
        if (v) v.textContent = Math.round(brushHardness * 100) + '%';
      });
    }
    $('opacity').addEventListener('input', () => {
      opacity = +$('opacity').value / 100;
      $('opacity-value').textContent = Math.round(opacity * 100) + '%';
    });
    $('stroke-color').addEventListener('input', () => {
      strokeColor = $('stroke-color').value;
      $('stroke-color-hex').value = strokeColor;
    });
    $('stroke-color-hex').addEventListener('input', () => {
      let v = $('stroke-color-hex').value.trim();
      if (/^#[0-9A-Fa-f]{3}$/.test(v)) {
        v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
      }
      if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
        strokeColor = v;
        $('stroke-color').value = v;
        $('stroke-color-hex').value = v;
      }
    });

    const layersPanel = $('layers-panel');
    const layersPanelToggle = $('layers-panel-toggle');
    if (layersPanelToggle && layersPanel) {
      layersPanelToggle.addEventListener('click', () => layersPanel.classList.toggle('is-open'));
    }
    const leftPanel = $('left-panel');
    const rightPanel = $('right-panel');
    const headerToggleLeft = $('header-toggle-left');
    const headerToggleRight = $('header-toggle-right');
    const leftPanelClose = $('left-panel-close');
    const rightPanelClose = $('right-panel-close');
    function isMobile() { return window.innerWidth <= 768; }
    if (isMobile()) {
      if (leftPanel) leftPanel.classList.add('collapsed');
      if (rightPanel) rightPanel.classList.add('collapsed');
    }
    if (headerToggleLeft && leftPanel) {
      headerToggleLeft.addEventListener('click', () => leftPanel.classList.toggle('collapsed'));
    }
    if (headerToggleRight && rightPanel) {
      headerToggleRight.addEventListener('click', () => rightPanel.classList.toggle('collapsed'));
    }
    if (leftPanelClose && leftPanel) {
      leftPanelClose.addEventListener('click', () => leftPanel.classList.add('collapsed'));
    }
    if (rightPanelClose && rightPanel) {
      rightPanelClose.addEventListener('click', () => rightPanel.classList.add('collapsed'));
    }
    let wasMobile = isMobile();
    window.addEventListener('resize', () => {
      const nowMobile = isMobile();
      if (wasMobile && !nowMobile && leftPanel) leftPanel.classList.remove('collapsed');
      if (wasMobile && !nowMobile && rightPanel) rightPanel.classList.remove('collapsed');
      wasMobile = nowMobile;
    });
    const layerUploadInput = $('layer-upload-input');
    if (layerUploadInput) {
      layerUploadInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const img = new Image();
        img.onload = () => {
          if (layers.length === 0) {
            initDoc(img.width, img.height);
            getActiveLayer().ctx.drawImage(img, 0, 0);
          } else {
            const layer = createLayer(img.width, img.height, getNextLayerName());
            layer.ctx.drawImage(img, 0, 0);
            layers.push(layer);
            activeLayerIndex = layers.length - 1;
          }
          composite();
          renderLayerList();
          saveHistory();
          updateImagePanelSize();
        };
        img.src = URL.createObjectURL(file);
        e.target.value = '';
      });
    }
    $('btn-new-layer').addEventListener('click', () => {
      if (!hasDocument()) return;
      const { w, h } = getDocSize();
      if (w && h) addLayer(w, h, getNextLayerName());
    });
    $('btn-delete-layer').addEventListener('click', () => {
      if (layers.length <= 1) return;
      layers.splice(activeLayerIndex, 1);
      activeLayerIndex = Math.min(activeLayerIndex, layers.length - 1);
      renderLayerList();
      composite();
      saveHistory();
    });
    $('btn-duplicate-layer').addEventListener('click', () => {
      if (!hasDocument()) return;
      const layer = getActiveLayer();
      if (!layer) return;
      const newL = createLayer(layer.canvas.width, layer.canvas.height, getNextLayerName());
      newL.ctx.drawImage(layer.canvas, 0, 0);
      newL.offsetX = layer.offsetX;
      newL.offsetY = layer.offsetY;
      layers.splice(activeLayerIndex + 1, 0, newL);
      activeLayerIndex++;
      renderLayerList();
      composite();
      saveHistory();
    });
    $('btn-merge-layer').addEventListener('click', () => {
      if (!hasDocument()) return;
      if (activeLayerIndex >= layers.length - 1) return;
      const curr = layers[activeLayerIndex];
      const below = layers[activeLayerIndex + 1];
      below.ctx.drawImage(curr.canvas, 0, 0, curr.canvas.width, curr.canvas.height, curr.offsetX, curr.offsetY, curr.canvas.width, curr.canvas.height);
      layers.splice(activeLayerIndex, 1);
      activeLayerIndex = Math.min(activeLayerIndex, layers.length - 1);
      renderLayerList();
      composite();
      saveHistory();
    });

    const COLOR_SWATCHES = ['#059669', '#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#808080'];
    const swatchEl = $('color-swatches');
    if (swatchEl) {
      COLOR_SWATCHES.forEach(hex => {
        const s = document.createElement('button');
        s.type = 'button';
        s.className = 'swatch';
        s.style.backgroundColor = hex;
        s.title = hex;
        s.addEventListener('click', () => {
          strokeColor = hex;
          $('stroke-color').value = hex;
          $('stroke-color-hex').value = hex;
        });
        swatchEl.appendChild(s);
      });
    }

    function safeImageAction(fn) {
      if (!hasDocument()) return;
      fn();
    }
    $('btn-brightness').addEventListener('click', () => safeImageAction(() => {
      showAdjustModal('Brightness / Contrast', 'Brightness', 0, 200, 100, 'Contrast', 0, 200, 100, () => {
        applyToActiveLayer(id => adjustBrightnessContrast(id, +$('adjust-slider-1').value, +$('adjust-slider-2').value));
      });
    }));
    $('btn-saturation').addEventListener('click', () => safeImageAction(() => {
      showAdjustModal('Hue / Saturation', 'Saturation', 0, 200, 100, null, null, null, null, () => {
        applyToActiveLayer(id => adjustSaturation(id, +$('adjust-slider-1').value));
      });
    }));
    $('btn-invert').addEventListener('click', () => safeImageAction(() => applyToActiveLayer(invert)));
    $('btn-grayscale').addEventListener('click', () => safeImageAction(() => applyToActiveLayer(grayscale)));
    $('btn-blur').addEventListener('click', () => safeImageAction(() => {
      showAdjustModal('Blur', 'Radius', 0, 20, 3, null, null, null, null, () => {
        applyToActiveLayer(id => blur(id, +$('adjust-slider-1').value));
      });
    }));
    $('btn-flip-h').addEventListener('click', () => safeImageAction(() => applyToActiveLayer(flipHorizontal)));
    $('btn-flip-v').addEventListener('click', () => safeImageAction(() => applyToActiveLayer(flipVertical)));

    const btnResize = $('btn-resize');
    if (btnResize) btnResize.addEventListener('click', () => {
      if (!hasDocument()) return;
      const nw = parseInt($('resize-width').value, 10);
      const nh = parseInt($('resize-height').value, 10);
      if (nw > 0 && nh > 0) resizeDocument(nw, nh);
    });
    const btnCopySel = $('btn-copy-selection');
    if (btnCopySel) btnCopySel.addEventListener('click', () => copySelectionAsLayer());
    const btnCropToSel = $('btn-crop-to-selection');
    if (btnCropToSel) btnCropToSel.addEventListener('click', () => cropToSelection());
    const btnClearSel = $('btn-clear-selection');
    if (btnClearSel) btnClearSel.addEventListener('click', () => {
      selection = null;
      drawSelection();
    });
    const btnApplyText = $('btn-apply-text');
    if (btnApplyText) btnApplyText.addEventListener('click', () => applyTextToLayer());
    ['text-input', 'text-size', 'text-font', 'text-color'].forEach(id => {
      const el = $(id);
      if (el) el.addEventListener('input', () => { if (activeTextBox) drawSelection(); });
      if (el) el.addEventListener('change', () => { if (activeTextBox) drawSelection(); });
    });
    const pixelateSizeEl = $('pixelate-size');
    if (pixelateSizeEl) pixelateSizeEl.addEventListener('input', () => {
      const v = $('pixelate-size-value');
      if (v) v.textContent = pixelateSizeEl.value;
    });
    const btnApplyPixelate = $('btn-apply-pixelate');
    if (btnApplyPixelate) btnApplyPixelate.addEventListener('click', () => {
      if (!hasDocument()) return;
      const blockPx = parseInt($('pixelate-size').value, 10) || 4;
      applyToActiveLayer(id => pixelateByBlockSize(id, blockPx));
      setStatus('Pixelate applied. Use Undo to restore original.');
    });

    $('btn-create-doc').addEventListener('click', () => {
      const w = Math.max(1, parseInt($('new-width').value, 10) || 800);
      const h = Math.max(1, parseInt($('new-height').value, 10) || 600);
      initDoc(w, h);
      $('new-doc-modal').classList.remove('open');
    });
    $('btn-cancel-new').addEventListener('click', () => $('new-doc-modal').classList.remove('open'));

    $('file-input').addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (f) openImage(f);
      e.target.value = '';
    });

    const headerNew = $('header-new-btn');
    if (headerNew) headerNew.addEventListener('click', () => showNewDocModal());
    const headerSave = $('header-save-btn');
    if (headerSave) headerSave.addEventListener('click', () => savePNG());
    const headerExport = $('header-export-btn');
    const exportMenu = $('export-menu');
    if (headerExport && exportMenu) {
      headerExport.addEventListener('click', (e) => {
        e.stopPropagation();
        headerExport.closest('.header-save-group')?.classList.toggle('open');
      });
      exportMenu.addEventListener('click', (e) => e.stopPropagation());
      exportMenu.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.dataset.export === 'jpg') saveJPG();
          else savePNG();
          headerExport.closest('.header-save-group')?.classList.remove('open');
        });
      });
    }
    document.addEventListener('click', () => document.querySelector('.header-save-group.open')?.classList.remove('open'));
    const headerRemoveBg = $('header-remove-bg-btn');
    if (headerRemoveBg) headerRemoveBg.addEventListener('click', () => removeBackground());
    const headerMagicRestore = $('header-magic-restore-btn');
    if (headerMagicRestore) headerMagicRestore.addEventListener('click', () => {
      tool = 'magicrestore';
      byClass('.tool-btn').forEach(b => { b.classList.remove('active'); if (b.dataset.tool === 'magicrestore') b.classList.add('active'); });
    });
    const headerUndo = $('header-undo-btn');
    if (headerUndo) headerUndo.addEventListener('click', () => undo());
    const headerRedo = $('header-redo-btn');
    if (headerRedo) headerRedo.addEventListener('click', () => redo());
    const welcomeNew = $('btn-welcome-new');
    if (welcomeNew) welcomeNew.addEventListener('click', () => showNewDocModal());

    const canvasWrap = $('canvas-wrap');
    if (canvasWrap) {
      canvasWrap.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const delta = e.deltaY > 0 ? -0.1 : 0.1;
          zoom = Math.max(0.25, Math.min(4, zoom + delta));
          applyZoom();
        }
      }, { passive: false });
    }

    $('adjust-slider-1').addEventListener('input', () => { $('adjust-value-1').textContent = $('adjust-slider-1').value; });
    $('adjust-slider-2').addEventListener('input', () => { $('adjust-value-2').textContent = $('adjust-slider-2').value; });
    $('btn-apply-adjust').addEventListener('click', () => {
      if ($('adjust-modal')._callback) $('adjust-modal')._callback();
      $('adjust-modal').classList.remove('open');
    });
    $('btn-cancel-adjust').addEventListener('click', () => $('adjust-modal').classList.remove('open'));

    zoom = 1;
    $('zoom-slider').value = 100;
    $('zoom-in').addEventListener('click', () => { zoom = Math.min(4, zoom + 0.25); applyZoom(); });
    $('zoom-out').addEventListener('click', () => { zoom = Math.max(0.25, zoom - 0.25); applyZoom(); });
    $('zoom-slider').addEventListener('input', () => { zoom = +$('zoom-slider').value / 100; applyZoom(); });

    function applyZoom() {
      container.style.transform = `scale(${zoom})`;
      $('status-zoom').textContent = Math.round(zoom * 100) + '%';
      $('zoom-slider').value = Math.round(zoom * 100);
    }

    updateUndoRedoButtons();
  }

  setupUI();
})();
