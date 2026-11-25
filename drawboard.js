(() => {
  "use strict";

  // ============================================================
  // Mikbatz 1 — Personal Drawing Board (100% Local IndexedDB)
  // Zero server / Cloudflare Worker traffic.
  // ============================================================

  const DB_NAME = "mikbatz1_drawboard_v1";
  const DB_VERSION = 1;
  const STORE_BOARDS = "boards";
  const STORE_ASSETS = "assets";

  const WIDTH_STORAGE_KEY = "mikbatz1_drawboard_width_v1";
  const GRID_DEFAULT_KEY = "mikbatz1_drawboard_grid_v1";

  const WORLD_W = 800;
  const WORLD_H = 1040;
  const MAX_UNDO = 40;
  const SAVE_DEBOUNCE_MS = 350;
  const MAX_IMAGE_DIM = 1400;
  const IMAGE_QUALITY = 0.82;
  const DEFAULT_PANEL_WIDTH = 460;
  const MIN_PANEL_WIDTH = 340;
  const MOBILE_BREAKPOINT = 1024;
  const HANDLE_RADIUS_CSS = 7;

  const STROKE_SIZES = {
    sm: { pen: 2.4, highlighter: 14, shape: 2.4, text: 18 },
    md: { pen: 4.5, highlighter: 22, shape: 4.0, text: 24 },
    lg: { pen: 8.0, highlighter: 34, shape: 6.5, text: 32 },
  };

  const SHAPE_LABELS = {
    arrow: "חץ",
    line: "קו",
    rect: "מלבן",
    ellipse: "עיגול",
  };

  // State
  let initialized = false;
  let dbPromise = null;
  let memoryBoards = new Map();
  let memoryAssets = new Map();
  let useMemoryFallback = false;

  let savedBoardKeys = new Set();
  let onStateChangeCb = null;
  let getActiveQuestionCb = null;
  let showToastCb = null;

  let isAvailable = true;
  let userWantsOpen = false;
  let activeTab = "question"; // "question" | "scratchpad"
  let activeQuestion = null; // { id, exam, num, images: [] }

  let currentBoardKey = null;
  let currentItems = [];
  let currentBgGrid = false;
  let undoStack = [];
  let redoStack = [];
  let dirty = false;
  let saveTimer = null;
  let loadSeq = 0;
  let pendingOrphanCleanup = false;

  // Tool state
  let currentTool = "pen"; // "select" | "pen" | "highlighter" | "eraser" | "shape" | "text"
  let currentShapeKind = "arrow"; // "arrow" | "line" | "rect" | "ellipse"
  let currentColor = "#111827";
  let currentSizeKey = "md"; // "sm" | "md" | "lg"

  // Canvas & Viewport state
  let stageCssW = 440;
  let stageCssH = 560;
  let viewScale = 0.55;
  let viewOffsetX = 0;
  let viewOffsetY = 0;
  let dpr = 1;
  let rafId = null;

  // Pointer & interaction state
  let activePointerId = null;
  let lastPenTime = 0;
  let activePenPointerId = null;
  let interaction = null; // { type: "draw-stroke"|"draw-shape"|"erase"|"drag-item"|"resize-item", ... }
  let selectedId = null;
  let eraserCursorWorld = null;
  let dragStartSnapshot = null;
  let dragMoved = false;
  let eraseChanged = false;
  let lastClickInfo = { time: 0, itemId: null };

  // Text editor state
  let editingText = null; // { id: string|null, x: number, y: number, color: string, fontSize: number }

  // Image runtime cache: key ("asset:<id>" or "src:<url>") -> { img, status: "loading"|"ready"|"error", objectUrl? }
  const imageCache = new Map();

  // DOM refs
  const dom = {};

  function $(id) {
    return document.getElementById(id);
  }

  function uid(prefix = "it") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function cloneItems(items) {
    return items.map((item) => {
      if (item.type === "stroke") {
        return {
          ...item,
          points: item.points.map((p) => [p[0], p[1]]),
        };
      }
      return { ...item };
    });
  }

  function isMobileLayout() {
    return window.innerWidth < MOBILE_BREAKPOINT;
  }

  function isVisiblyOpen() {
    return Boolean(userWantsOpen && isAvailable);
  }

  function getTargetBoardKey() {
    if (activeTab === "scratchpad" || !activeQuestion?.id) {
      return "scratchpad";
    }
    return `q:${activeQuestion.id}`;
  }

  function emitStateChange() {
    if (typeof onStateChangeCb === "function") {
      try {
        onStateChangeCb({
          open: isVisiblyOpen(),
          available: isAvailable,
          tab: activeTab,
          boardKey: currentBoardKey,
          activeQuestionId: activeQuestion?.id || null,
        });
      } catch {}
    }
  }

  function notify(msg) {
    if (typeof showToastCb === "function") {
      showToastCb(msg);
    }
  }

  // ============================================================
  // IndexedDB Engine
  // ============================================================

  function openDb() {
    if (useMemoryFallback) return Promise.resolve(null);
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve) => {
      if (typeof indexedDB === "undefined") {
        useMemoryFallback = true;
        resolve(null);
        return;
      }
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_BOARDS)) {
            db.createObjectStore(STORE_BOARDS, { keyPath: "boardKey" });
          }
          if (!db.objectStoreNames.contains(STORE_ASSETS)) {
            db.createObjectStore(STORE_ASSETS, { keyPath: "assetId" });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          useMemoryFallback = true;
          resolve(null);
        };
      } catch {
        useMemoryFallback = true;
        resolve(null);
      }
    });

    return dbPromise;
  }

  async function idbGetAllBoardKeys() {
    const db = await openDb();
    if (!db) return Array.from(memoryBoards.keys());
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_BOARDS, "readonly");
        const req = tx.objectStore(STORE_BOARDS).getAllKeys();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  async function idbGetBoard(boardKey) {
    const db = await openDb();
    if (!db) return memoryBoards.get(boardKey) || null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_BOARDS, "readonly");
        const req = tx.objectStore(STORE_BOARDS).get(boardKey);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async function idbPutBoard(record) {
    const db = await openDb();
    if (!db) {
      memoryBoards.set(record.boardKey, record);
      return true;
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_BOARDS, "readwrite");
        tx.objectStore(STORE_BOARDS).put(record);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  async function idbDeleteBoard(boardKey) {
    const db = await openDb();
    if (!db) {
      memoryBoards.delete(boardKey);
      return true;
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_BOARDS, "readwrite");
        tx.objectStore(STORE_BOARDS).delete(boardKey);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  async function idbPutAsset(record) {
    const db = await openDb();
    if (!db) {
      memoryAssets.set(record.assetId, record);
      return true;
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_ASSETS, "readwrite");
        tx.objectStore(STORE_ASSETS).put(record);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  async function idbGetAsset(assetId) {
    const db = await openDb();
    if (!db) return memoryAssets.get(assetId) || null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_ASSETS, "readonly");
        const req = tx.objectStore(STORE_ASSETS).get(assetId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async function cleanupOrphanAssets() {
    const db = await openDb();
    const keepIds = new Set();

    // Preserve assets referenced in active undo/redo stacks so Undo works safely
    const collectFromItems = (items) => {
      if (!Array.isArray(items)) return;
      for (const it of items) {
        if (it && it.type === "image" && it.assetId) {
          keepIds.add(it.assetId);
        }
      }
    };
    collectFromItems(currentItems);
    for (const snap of undoStack) collectFromItems(snap);
    for (const snap of redoStack) collectFromItems(snap);

    if (!db) {
      for (const b of memoryBoards.values()) collectFromItems(b.items);
      for (const key of Array.from(memoryAssets.keys())) {
        if (!keepIds.has(key)) {
          memoryAssets.delete(key);
          evictCachedAsset(key);
        }
      }
      return;
    }

    try {
      const boards = await new Promise((resolve) => {
        const tx = db.transaction(STORE_BOARDS, "readonly");
        const req = tx.objectStore(STORE_BOARDS).getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => resolve([]);
      });
      for (const b of boards) collectFromItems(b.items);

      const assetKeys = await new Promise((resolve) => {
        const tx = db.transaction(STORE_ASSETS, "readonly");
        const req = tx.objectStore(STORE_ASSETS).getAllKeys();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => resolve([]);
      });

      const orphanKeys = assetKeys.filter((k) => !keepIds.has(k));
      if (orphanKeys.length === 0) return;

      await new Promise((resolve) => {
        const tx = db.transaction(STORE_ASSETS, "readwrite");
        const store = tx.objectStore(STORE_ASSETS);
        for (const k of orphanKeys) {
          store.delete(k);
          evictCachedAsset(k);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {}
  }

  function evictCachedAsset(assetId) {
    const cacheKey = `asset:${assetId}`;
    const entry = imageCache.get(cacheKey);
    if (entry?.objectUrl) {
      try {
        URL.revokeObjectURL(entry.objectUrl);
      } catch {}
    }
    imageCache.delete(cacheKey);
  }

  async function refreshSavedKeysIndex() {
    const keys = await idbGetAllBoardKeys();
    savedBoardKeys = new Set(keys);
    emitStateChange();
  }

  function setSaveStatusText(text, stateClass = "") {
    if (!dom.saveStatus) return;
    dom.saveStatus.textContent = text;
    dom.saveStatus.className = "drawboard-save-status" + (stateClass ? ` ${stateClass}` : "");
  }

  function scheduleSave() {
    dirty = true;
    setSaveStatusText("שומר מקומית…", "saving");
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      flushSave();
    }, SAVE_DEBOUNCE_MS);
  }

  async function flushSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (!dirty || !currentBoardKey) return;
    const key = currentBoardKey;
    const itemsCopy = cloneItems(currentItems);
    const bgGrid = currentBgGrid;
    dirty = false;

    if (itemsCopy.length === 0) {
      await idbDeleteBoard(key);
      savedBoardKeys.delete(key);
    } else {
      await idbPutBoard({
        boardKey: key,
        updatedAt: Date.now(),
        bgGrid,
        items: itemsCopy,
      });
      savedBoardKeys.add(key);
    }

    if (pendingOrphanCleanup) {
      pendingOrphanCleanup = false;
      cleanupOrphanAssets();
    }

    setSaveStatusText("נשמר מקומית", "saved");
    updateTabBadges();
    emitStateChange();
  }

  function loadDefaultGridPref() {
    try {
      return localStorage.getItem(GRID_DEFAULT_KEY) === "1";
    } catch {
      return false;
    }
  }

  function saveDefaultGridPref(val) {
    try {
      localStorage.setItem(GRID_DEFAULT_KEY, val ? "1" : "0");
    } catch {}
  }

  async function loadBoard(boardKey) {
    if (dirty) {
      await flushSave();
    }
    const seq = ++loadSeq;
    currentBoardKey = boardKey;
    selectedId = null;
    commitTextEditor(false);
    undoStack = [];
    redoStack = [];
    currentItems = [];
    currentBgGrid = loadDefaultGridPref();
    dirty = false;
    updateUndoRedoButtons();
    updateSelectionBar();
    updateGridButtonUI();
    requestRender();

    const rec = await idbGetBoard(boardKey);
    if (seq !== loadSeq) return; // Superseded by a newer board switch

    if (rec && Array.isArray(rec.items)) {
      currentItems = cloneItems(rec.items);
      if (typeof rec.bgGrid === "boolean") {
        currentBgGrid = rec.bgGrid;
      }
      if (currentItems.length > 0) {
        savedBoardKeys.add(boardKey);
      }
    }

    updateGridButtonUI();
    updateEmptyHint();
    updateUndoRedoButtons();
    updateTabBadges();
    setSaveStatusText("נשמר מקומית", "saved");
    preloadBoardImages(currentItems);
    requestRender();
    emitStateChange();
  }

  // ============================================================
  // Undo / Redo History
  // ============================================================

  function pushUndo(snapshot = null) {
    const snap = snapshot || cloneItems(currentItems);
    undoStack.push(snap);
    if (undoStack.length > MAX_UNDO) {
      undoStack.shift();
    }
    redoStack = [];
    updateUndoRedoButtons();
  }

  function undo() {
    if (undoStack.length === 0) return;
    commitTextEditor(true);
    redoStack.push(cloneItems(currentItems));
    currentItems = undoStack.pop();
    if (selectedId && !currentItems.some((it) => it.id === selectedId)) {
      selectedId = null;
    }
    preloadBoardImages(currentItems);
    updateUndoRedoButtons();
    updateSelectionBar();
    updateEmptyHint();
    scheduleSave();
    requestRender();
  }

  function redo() {
    if (redoStack.length === 0) return;
    commitTextEditor(true);
    undoStack.push(cloneItems(currentItems));
    currentItems = redoStack.pop();
    if (selectedId && !currentItems.some((it) => it.id === selectedId)) {
      selectedId = null;
    }
    preloadBoardImages(currentItems);
    updateUndoRedoButtons();
    updateSelectionBar();
    updateEmptyHint();
    scheduleSave();
    requestRender();
  }

  function updateUndoRedoButtons() {
    if (dom.btnUndo) dom.btnUndo.disabled = undoStack.length === 0;
    if (dom.btnRedo) dom.btnRedo.disabled = redoStack.length === 0;
  }

  // ============================================================
  // Image Loading, Compression & Placement
  // ============================================================

  function getImageCacheEntry(item) {
    const cacheKey = item.assetId ? `asset:${item.assetId}` : `src:${item.src}`;
    const existing = imageCache.get(cacheKey);
    if (existing) return existing;

    const entry = { img: null, status: "loading", objectUrl: null };
    imageCache.set(cacheKey, entry);

    if (item.assetId) {
      idbGetAsset(item.assetId).then((rec) => {
        if (!rec || !rec.blob) {
          entry.status = "error";
          requestRender();
          return;
        }
        const url = URL.createObjectURL(rec.blob);
        entry.objectUrl = url;
        const img = new Image();
        img.onload = () => {
          entry.img = img;
          entry.status = "ready";
          requestRender();
        };
        img.onerror = () => {
          entry.status = "error";
          requestRender();
        };
        img.src = url;
      });
    } else if (item.src) {
      const img = new Image();
      img.onload = () => {
        entry.img = img;
        entry.status = "ready";
        requestRender();
      };
      img.onerror = () => {
        entry.status = "error";
        requestRender();
      };
      img.src = item.src;
    } else {
      entry.status = "error";
    }

    return entry;
  }

  function preloadBoardImages(items) {
    for (const it of items) {
      if (it && it.type === "image") {
        getImageCacheEntry(it);
      }
    }
  }

  function loadImageElementFromBlob(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      img.src = url;
    });
  }

  function loadImageElementFromSrc(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = src;
    });
  }

  function canvasToCompressedBlob(canvas) {
    return new Promise((resolve) => {
      canvas.toBlob(
        (webpBlob) => {
          if (webpBlob && webpBlob.type === "image/webp" && webpBlob.size > 0) {
            resolve({ blob: webpBlob, mime: "image/webp" });
            return;
          }
          canvas.toBlob(
            (jpegBlob) => {
              if (jpegBlob && jpegBlob.size > 0) {
                resolve({ blob: jpegBlob, mime: "image/jpeg" });
              } else {
                resolve(null);
              }
            },
            "image/jpeg",
            IMAGE_QUALITY
          );
        },
        "image/webp",
        IMAGE_QUALITY
      );
    });
  }

  async function compressImageFile(fileOrBlob) {
    const img = await loadImageElementFromBlob(fileOrBlob);
    const natW = img.naturalWidth || img.width || 600;
    const natH = img.naturalHeight || img.height || 400;

    let outW = natW;
    let outH = natH;
    const maxSide = Math.max(natW, natH);
    if (maxSide > MAX_IMAGE_DIM) {
      const ratio = MAX_IMAGE_DIM / maxSide;
      outW = Math.max(1, Math.round(natW * ratio));
      outH = Math.max(1, Math.round(natH * ratio));
    }

    const off = document.createElement("canvas");
    off.width = outW;
    off.height = outH;
    const octx = off.getContext("2d");
    octx.fillStyle = "#FFFFFF";
    octx.fillRect(0, 0, outW, outH);
    octx.drawImage(img, 0, 0, outW, outH);

    const compressed = await canvasToCompressedBlob(off);
    if (!compressed) {
      return { blob: fileOrBlob, mime: fileOrBlob.type || "image/png", w: outW, h: outH };
    }
    return { blob: compressed.blob, mime: compressed.mime, w: outW, h: outH };
  }

  function computeImagePlacement(natW, natH) {
    const existingImages = currentItems.filter((it) => it.type === "image").length;
    const maxW = WORLD_W * 0.86;
    const maxH = WORLD_H * 0.56;
    const scale = Math.min(maxW / Math.max(1, natW), maxH / Math.max(1, natH), 1);
    let w = Math.max(120, Math.round(natW * scale));
    let h = Math.max(90, Math.round(natH * scale));
    if (w > maxW) {
      const r = maxW / w;
      w = Math.round(w * r);
      h = Math.round(h * r);
    }
    if (h > maxH) {
      const r = maxH / h;
      w = Math.round(w * r);
      h = Math.round(h * r);
    }
    const stagger = (existingImages % 4) * 26;
    const x = Math.max(24, Math.min(WORLD_W - w - 24, Math.round((WORLD_W - w) / 2) + stagger - 12));
    const y = Math.max(28, Math.min(WORLD_H - h - 28, 36 + stagger));
    return { x, y, w, h };
  }

  async function addUploadedImageFile(file) {
    if (!file || !file.type || !file.type.startsWith("image/")) return;
    try {
      setSaveStatusText("מעבד תמונה…", "saving");
      const { blob, mime, w: natW, h: natH } = await compressImageFile(file);
      const assetId = uid("img");
      await idbPutAsset({
        assetId,
        blob,
        mime,
        w: natW,
        h: natH,
        createdAt: Date.now(),
      });

      const pos = computeImagePlacement(natW, natH);
      const item = {
        id: uid("it"),
        type: "image",
        x: pos.x,
        y: pos.y,
        w: pos.w,
        h: pos.h,
        assetId,
        label: file.name || "תמונה",
      };

      pushUndo();
      currentItems.push(item);
      selectedId = item.id;
      setTool("select");
      getImageCacheEntry(item);
      updateSelectionBar();
      updateEmptyHint();
      scheduleSave();
      requestRender();
      notify("🖼️ התמונה נוספה ללוח (דחוסה ונשמרה מקומית)");
    } catch {
      setSaveStatusText("שגיאה בטעינת תמונה", "");
      notify("לא הצלחנו לטעון את התמונה.");
    }
  }

  async function importQuestionImage(src, caption = "") {
    if (!src) return;
    if (!isAvailable) {
      notify("לוח הציור זמין במצבי תרגול וסימולציה.");
      return;
    }
    open();
    // Wait a tick if a board load is in progress
    if (!currentBoardKey) {
      await loadBoard(getTargetBoardKey());
    }

    let natW = 640;
    let natH = 440;
    try {
      const img = await loadImageElementFromSrc(src);
      natW = img.naturalWidth || img.width || 640;
      natH = img.naturalHeight || img.height || 440;
    } catch {}

    const pos = computeImagePlacement(natW, natH);
    const item = {
      id: uid("it"),
      type: "image",
      x: pos.x,
      y: pos.y,
      w: pos.w,
      h: pos.h,
      src,
      label: caption || "תמונת שאלה",
    };

    pushUndo();
    currentItems.push(item);
    selectedId = item.id;
    getImageCacheEntry(item);
    // Keep pen active if user was drawing, or select so they can reposition?
    // Keeping pen/highlighter ready if already drawing, otherwise select; actually highlighting briefly in select or keeping tool feels super natural.
    // Let's switch to pen if currently on eraser, or select so corner resize handles are immediately visible!
    setTool("select");
    updateSelectionBar();
    updateEmptyHint();
    scheduleSave();
    requestRender();
    notify("🎨 תמונת השאלה נוספה ללוח — אפשר לסמן מעליה או לשנות גודל");
  }

  // ============================================================
  // Coordinate Mapping & Hit Testing
  // ============================================================

  function syncTopbarOffset() {
    const topbar = document.querySelector(".topbar");
    const h = topbar ? Math.ceil(topbar.getBoundingClientRect().height) : 64;
    const topOffset = Math.max(56, h + 12);
    document.documentElement.style.setProperty("--drawboard-top", `${topOffset}px`);
  }

  function updateCanvasMetrics() {
    if (!dom.canvas || !dom.stage) return;
    syncTopbarOffset();
    const rect = dom.stage.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;

    stageCssW = rect.width;
    stageCssH = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    const targetW = Math.round(stageCssW * dpr);
    const targetH = Math.round(stageCssH * dpr);
    if (dom.canvas.width !== targetW || dom.canvas.height !== targetH) {
      dom.canvas.width = targetW;
      dom.canvas.height = targetH;
    }

    viewScale = Math.min(stageCssW / WORLD_W, stageCssH / WORLD_H);
    viewOffsetX = (stageCssW - WORLD_W * viewScale) / 2;
    viewOffsetY = (stageCssH - WORLD_H * viewScale) / 2;

    if (editingText) {
      positionTextEditor();
    }
    requestRender();
  }

  function clientToWorld(clientX, clientY) {
    const rect = dom.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: (sx - viewOffsetX) / viewScale,
      y: (sy - viewOffsetY) / viewScale,
    };
  }

  function worldToStage(wx, wy) {
    return {
      x: wx * viewScale + viewOffsetX,
      y: wy * viewScale + viewOffsetY,
    };
  }

  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function measureTextBox(item) {
    const canvas = dom.canvas;
    const ctx = canvas ? canvas.getContext("2d") : null;
    const fontSize = item.fontSize || 24;
    const lineHeight = fontSize * 1.32;
    const lines = String(item.text || "").split("\n");
    let maxW = 40;
    if (ctx) {
      ctx.save();
      ctx.font = `600 ${fontSize}px "Heebo", "Segoe UI", "Arial", sans-serif`;
      for (const line of lines) {
        const w = ctx.measureText(line || " ").width;
        if (w > maxW) maxW = w;
      }
      ctx.restore();
    } else {
      maxW = Math.max(40, ...lines.map((l) => l.length * fontSize * 0.6));
    }
    const padX = 8;
    const padY = 5;
    const w = maxW + padX * 2;
    const h = Math.max(1, lines.length) * lineHeight + padY * 2;
    // Detect RTL line alignment for box positioning
    const isRtl = /[\u0590-\u05FF]/.test(item.text || "");
    const x = isRtl ? item.x - w : item.x;
    return { x, y: item.y, w, h, lineHeight, padX, padY, isRtl };
  }

  function getItemBounds(item) {
    if (!item) return null;
    if (item.type === "image") {
      return { x: item.x, y: item.y, w: item.w, h: item.h };
    }
    if (item.type === "text") {
      const m = measureTextBox(item);
      return { x: m.x, y: m.y, w: m.w, h: m.h };
    }
    if (item.type === "shape") {
      const x1 = Math.min(item.x1, item.x2);
      const y1 = Math.min(item.y1, item.y2);
      const x2 = Math.max(item.x1, item.x2);
      const y2 = Math.max(item.y1, item.y2);
      const pad = Math.max(8, (item.size || 4) * 1.5);
      return { x: x1 - pad, y: y1 - pad, w: Math.max(16, x2 - x1 + pad * 2), h: Math.max(16, y2 - y1 + pad * 2) };
    }
    if (item.type === "stroke" && Array.isArray(item.points) && item.points.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of item.points) {
        if (p[0] < minX) minX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] > maxY) maxY = p[1];
      }
      const pad = Math.max(8, (item.size || 4) / 2 + 4);
      return { x: minX - pad, y: minY - pad, w: Math.max(12, maxX - minX + pad * 2), h: Math.max(12, maxY - minY + pad * 2) };
    }
    return null;
  }

  function getCornerHandles(item) {
    if (!item || (item.type !== "image" && !(item.type === "shape" && (item.kind === "rect" || item.kind === "ellipse")))) {
      return [];
    }
    let x, y, w, h;
    if (item.type === "image") {
      ({ x, y, w, h } = item);
    } else {
      x = Math.min(item.x1, item.x2);
      y = Math.min(item.y1, item.y2);
      w = Math.abs(item.x2 - item.x1);
      h = Math.abs(item.y2 - item.y1);
    }
    return [
      { id: "nw", x, y },
      { id: "ne", x: x + w, y },
      { id: "sw", x, y: y + h },
      { id: "se", x: x + w, y: y + h },
    ];
  }

  function hitTestCornerHandle(wx, wy, item) {
    const handles = getCornerHandles(item);
    const hitRadius = (HANDLE_RADIUS_CSS + 6) / viewScale;
    for (const h of handles) {
      if (Math.hypot(wx - h.x, wy - h.y) <= hitRadius) {
        return h.id;
      }
    }
    return null;
  }

  function hitTestItem(item, wx, wy, extraTol = 0) {
    const baseTol = 12 / viewScale + extraTol;
    if (item.type === "image") {
      return wx >= item.x && wx <= item.x + item.w && wy >= item.y && wy <= item.y + item.h;
    }
    if (item.type === "text") {
      const b = measureTextBox(item);
      return wx >= b.x - 4 && wx <= b.x + b.w + 4 && wy >= b.y - 4 && wy <= b.y + b.h + 4;
    }
    if (item.type === "stroke") {
      const pts = item.points;
      if (!pts || pts.length === 0) return false;
      const tol = Math.max(baseTol, (item.size || 4) * 0.65 + extraTol);
      if (pts.length === 1) {
        return Math.hypot(wx - pts[0][0], wy - pts[0][1]) <= tol;
      }
      for (let i = 1; i < pts.length; i++) {
        if (distToSegment(wx, wy, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) <= tol) {
          return true;
        }
      }
      return false;
    }
    if (item.type === "shape") {
      const tol = Math.max(baseTol, (item.size || 4) + extraTol);
      if (item.kind === "line" || item.kind === "arrow") {
        return distToSegment(wx, wy, item.x1, item.y1, item.x2, item.y2) <= tol;
      }
      const x1 = Math.min(item.x1, item.x2);
      const y1 = Math.min(item.y1, item.y2);
      const x2 = Math.max(item.x1, item.x2);
      const y2 = Math.max(item.y1, item.y2);
      if (item.kind === "rect") {
        const nearBorder =
          distToSegment(wx, wy, x1, y1, x2, y1) <= tol ||
          distToSegment(wx, wy, x2, y1, x2, y2) <= tol ||
          distToSegment(wx, wy, x2, y2, x1, y2) <= tol ||
          distToSegment(wx, wy, x1, y2, x1, y1) <= tol;
        return nearBorder;
      }
      if (item.kind === "ellipse") {
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const rx = Math.max(4, (x2 - x1) / 2);
        const ry = Math.max(4, (y2 - y1) / 2);
        const nx = (wx - cx) / rx;
        const ny = (wy - cy) / ry;
        const normDist = Math.hypot(nx, ny);
        const radialTol = tol / Math.max(10, Math.min(rx, ry));
        return Math.abs(normDist - 1) <= Math.max(0.16, radialTol);
      }
    }
    return false;
  }

  function findTopHit(wx, wy, { includeImages = true, extraTol = 0 } = {}) {
    // Search in reverse visual layer order: Text -> Stroke/Shape -> Image
    for (let i = currentItems.length - 1; i >= 0; i--) {
      const it = currentItems[i];
      if (it.type === "text" && hitTestItem(it, wx, wy, extraTol)) return it;
    }
    for (let i = currentItems.length - 1; i >= 0; i--) {
      const it = currentItems[i];
      if ((it.type === "stroke" || it.type === "shape") && hitTestItem(it, wx, wy, extraTol)) return it;
    }
    if (includeImages) {
      for (let i = currentItems.length - 1; i >= 0; i--) {
        const it = currentItems[i];
        if (it.type === "image" && hitTestItem(it, wx, wy, extraTol)) return it;
      }
    }
    return null;
  }

  function moveItemBy(item, dx, dy) {
    if (item.type === "image" || item.type === "text") {
      item.x += dx;
      item.y += dy;
    } else if (item.type === "shape") {
      item.x1 += dx;
      item.y1 += dy;
      item.x2 += dx;
      item.y2 += dy;
    } else if (item.type === "stroke") {
      for (const p of item.points) {
        p[0] += dx;
        p[1] += dy;
      }
    }
  }

  // ============================================================
  // Rendering Engine (3 Strict Layers + Selection Overlay)
  // ============================================================

  function requestRender() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      renderCanvas();
    });
  }

  function drawDotGrid(ctx) {
    const step = 28;
    const minWX = Math.floor((-viewOffsetX / viewScale) / step) * step;
    const maxWX = Math.ceil(((stageCssW - viewOffsetX) / viewScale) / step) * step;
    const minWY = Math.floor((-viewOffsetY / viewScale) / step) * step;
    const maxWY = Math.ceil(((stageCssH - viewOffsetY) / viewScale) / step) * step;

    ctx.save();
    ctx.fillStyle = "#CBD5E1";
    const r = Math.max(1.1, 1.3 / viewScale);
    for (let x = minWX; x <= maxWX; x += step) {
      for (let y = minWY; y <= maxWY; y += step) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawImageItem(ctx, item) {
    const entry = getImageCacheEntry(item);
    ctx.save();
    if (entry.status === "ready" && entry.img) {
      ctx.drawImage(entry.img, item.x, item.y, item.w, item.h);
    } else {
      ctx.fillStyle = "#F2EFE6";
      ctx.strokeStyle = "#C9C3B5";
      ctx.lineWidth = 1.5 / viewScale;
      ctx.fillRect(item.x, item.y, item.w, item.h);
      ctx.strokeRect(item.x, item.y, item.w, item.h);
      ctx.fillStyle = "#525866";
      ctx.font = `600 18px "Heebo", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        entry.status === "error" ? "תמונה לא זמינה" : "טוען תמונה…",
        item.x + item.w / 2,
        item.y + item.h / 2
      );
    }
    ctx.restore();
  }

  function drawStrokeItem(ctx, item) {
    const pts = item.points;
    if (!pts || pts.length === 0) return;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = item.color || "#111827";
    ctx.fillStyle = item.color || "#111827";
    ctx.lineWidth = item.size || 4;
    if (item.mode === "highlighter") {
      ctx.globalAlpha = 0.34;
    }

    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0][0], pts[0][1], (item.size || 4) / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) {
        const midX = (pts[i][0] + pts[i + 1][0]) / 2;
        const midY = (pts[i][1] + pts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], midX, midY);
      }
      const last = pts[pts.length - 1];
      ctx.lineTo(last[0], last[1]);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawShapeItem(ctx, item) {
    ctx.save();
    ctx.strokeStyle = item.color || "#111827";
    ctx.fillStyle = item.color || "#111827";
    ctx.lineWidth = item.size || 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const { x1, y1, x2, y2, kind } = item;
    if (kind === "line") {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    } else if (kind === "arrow") {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const headLen = Math.min(Math.max(14, (item.size || 4) * 3.8), Math.max(12, len * 0.45));
      const headAngle = Math.PI / 6.5;

      // Shorten shaft slightly so stroke tip doesn't poke past crisp arrowhead
      const shaftEndX = len > headLen ? x2 - Math.cos(angle) * (headLen * 0.45) : x2;
      const shaftEndY = len > headLen ? y2 - Math.sin(angle) * (headLen * 0.45) : y2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(shaftEndX, shaftEndY);
      ctx.stroke();

      if (len >= 4) {
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(
          x2 - headLen * Math.cos(angle - headAngle),
          y2 - headLen * Math.sin(angle - headAngle)
        );
        ctx.lineTo(
          x2 - headLen * Math.cos(angle + headAngle),
          y2 - headLen * Math.sin(angle + headAngle)
        );
        ctx.closePath();
        ctx.fill();
      }
    } else if (kind === "rect") {
      const rx = Math.min(x1, x2);
      const ry = Math.min(y1, y2);
      const rw = Math.abs(x2 - x1);
      const rh = Math.abs(y2 - y1);
      ctx.beginPath();
      ctx.rect(rx, ry, rw, rh);
      ctx.stroke();
    } else if (kind === "ellipse") {
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      const rx = Math.abs(x2 - x1) / 2;
      const ry = Math.abs(y2 - y1) / 2;
      if (rx > 0.5 && ry > 0.5) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawTextItem(ctx, item) {
    if (editingText && editingText.id === item.id) return; // Hidden while editing inline
    const box = measureTextBox(item);
    const fontSize = item.fontSize || 24;
    const lines = String(item.text || "").split("\n");

    ctx.save();
    // Subtle translucent white pill backdrop so text stays readable over ECG/radiology images
    ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(box.x, box.y, box.w, box.h, 6);
    } else {
      ctx.rect(box.x, box.y, box.w, box.h);
    }
    ctx.fill();

    ctx.fillStyle = item.color || "#111827";
    ctx.font = `600 ${fontSize}px "Heebo", "Segoe UI", "Arial", sans-serif`;
    ctx.textBaseline = "top";
    ctx.direction = box.isRtl ? "rtl" : "ltr";
    ctx.textAlign = box.isRtl ? "right" : "left";

    const drawX = box.isRtl ? box.x + box.w - box.padX : box.x + box.padX;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], drawX, box.y + box.padY + i * box.lineHeight);
    }
    ctx.restore();
  }

  function drawSelectionOverlay(ctx, item) {
    const b = getItemBounds(item);
    if (!b) return;

    ctx.save();
    ctx.strokeStyle = "#1D4ED8";
    ctx.lineWidth = 1.6 / viewScale;
    ctx.setLineDash([6 / viewScale, 4 / viewScale]);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.setLineDash([]);

    const handles = getCornerHandles(item);
    const hr = HANDLE_RADIUS_CSS / viewScale;
    for (const h of handles) {
      ctx.fillStyle = "#FFFFFF";
      ctx.strokeStyle = "#1D4ED8";
      ctx.lineWidth = 2 / viewScale;
      ctx.beginPath();
      ctx.arc(h.x, h.y, hr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function renderCanvas() {
    if (!dom.canvas) return;
    const ctx = dom.canvas.getContext("2d");
    if (!ctx) return;

    // White-Plate Rule: pure white backing in both Light & Dark mode
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, dom.canvas.width, dom.canvas.height);

    ctx.setTransform(
      dpr * viewScale,
      0,
      0,
      dpr * viewScale,
      dpr * viewOffsetX,
      dpr * viewOffsetY
    );

    if (currentBgGrid) {
      drawDotGrid(ctx);
    }

    // Layer 1: Images
    for (const it of currentItems) {
      if (it.type === "image") drawImageItem(ctx, it);
    }
    // Layer 2: Strokes & Shapes
    for (const it of currentItems) {
      if (it.type === "stroke") drawStrokeItem(ctx, it);
      else if (it.type === "shape") drawShapeItem(ctx, it);
    }
    // Layer 3: Text
    for (const it of currentItems) {
      if (it.type === "text") drawTextItem(ctx, it);
    }

    // Active preview item while drawing
    if (interaction?.draftItem) {
      if (interaction.draftItem.type === "stroke") {
        drawStrokeItem(ctx, interaction.draftItem);
      } else if (interaction.draftItem.type === "shape") {
        drawShapeItem(ctx, interaction.draftItem);
      }
    }

    // Selection overlay
    if (selectedId) {
      const selItem = currentItems.find((it) => it.id === selectedId);
      if (selItem) {
        drawSelectionOverlay(ctx, selItem);
      }
    }

    // Eraser cursor ring
    if (currentTool === "eraser" && eraserCursorWorld) {
      ctx.save();
      ctx.strokeStyle = "#B91C1C";
      ctx.fillStyle = "rgba(185, 28, 28, 0.12)";
      ctx.lineWidth = 1.5 / viewScale;
      const r = 14 / viewScale;
      ctx.beginPath();
      ctx.arc(eraserCursorWorld.x, eraserCursorWorld.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  // ============================================================
  // Inline Text Editor (dir="auto")
  // ============================================================

  function openTextEditor(wx, wy, existingItem = null) {
    commitTextEditor(true);
    closePopovers();
    if (!dom.textEditorWrap || !dom.textEditor) return;

    if (existingItem) {
      editingText = {
        id: existingItem.id,
        x: existingItem.x,
        y: existingItem.y,
        color: existingItem.color || currentColor,
        fontSize: existingItem.fontSize || STROKE_SIZES[currentSizeKey].text,
      };
      dom.textEditor.value = existingItem.text || "";
    } else {
      editingText = {
        id: null,
        x: Math.max(30, Math.min(WORLD_W - 30, wx)),
        y: Math.max(20, Math.min(WORLD_H - 60, wy)),
        color: currentColor,
        fontSize: STROKE_SIZES[currentSizeKey].text,
      };
      dom.textEditor.value = "";
    }

    dom.textEditor.style.color = editingText.color;
    dom.textEditor.style.fontSize = `${Math.max(13, Math.round(editingText.fontSize * viewScale))}px`;
    dom.textEditorWrap.classList.remove("hidden");
    positionTextEditor();
    requestRender();

    setTimeout(() => {
      dom.textEditor?.focus();
      dom.textEditor?.setSelectionRange(dom.textEditor.value.length, dom.textEditor.value.length);
    }, 0);
  }

  function positionTextEditor() {
    if (!editingText || !dom.textEditorWrap) return;
    const pos = worldToStage(editingText.x, editingText.y);
    const maxW = Math.max(150, stageCssW - 24);
    const left = Math.max(10, Math.min(stageCssW - 180, pos.x - 90));
    const top = Math.max(10, Math.min(stageCssH - 84, pos.y - 6));
    dom.textEditorWrap.style.left = `${left}px`;
    dom.textEditorWrap.style.top = `${top}px`;
    dom.textEditorWrap.style.maxWidth = `${maxW}px`;
  }

  function commitTextEditor(save) {
    if (!editingText) return;
    const state = editingText;
    const raw = dom.textEditor ? dom.textEditor.value : "";
    const trimmed = raw.trim();
    editingText = null;
    dom.textEditorWrap?.classList.add("hidden");

    if (save) {
      if (state.id) {
        const idx = currentItems.findIndex((it) => it.id === state.id);
        if (idx !== -1) {
          if (!trimmed) {
            pushUndo();
            currentItems.splice(idx, 1);
            if (selectedId === state.id) selectedId = null;
            scheduleSave();
          } else if (currentItems[idx].text !== trimmed) {
            pushUndo();
            currentItems[idx].text = trimmed;
            scheduleSave();
          }
        }
      } else if (trimmed) {
        pushUndo();
        const item = {
          id: uid("txt"),
          type: "text",
          x: state.x,
          y: state.y,
          text: trimmed,
          color: state.color,
          fontSize: state.fontSize,
        };
        currentItems.push(item);
        selectedId = item.id;
        scheduleSave();
      }
    }

    updateSelectionBar();
    updateEmptyHint();
    requestRender();
  }

  // ============================================================
  // Pointer Handling (Mouse, Touch, Stylus + Palm Rejection)
  // ============================================================

  function shouldRejectPalm(e) {
    if (e.pointerType === "pen") {
      lastPenTime = performance.now();
      return false;
    }
    if (e.pointerType === "touch") {
      if (activePenPointerId !== null) return true;
      if (performance.now() - lastPenTime < 550) return true;
    }
    return false;
  }

  function onCanvasPointerDown(e) {
    if (e.button === 2) return; // Ignore right-click
    if (shouldRejectPalm(e)) return;
    if (activePointerId !== null && activePointerId !== e.pointerId) return;

    closePopovers();
    if (editingText) {
      commitTextEditor(true);
    }

    const pt = clientToWorld(e.clientX, e.clientY);
    activePointerId = e.pointerId;
    if (e.pointerType === "pen") activePenPointerId = e.pointerId;

    try {
      dom.canvas.setPointerCapture(e.pointerId);
    } catch {}

    if (currentTool === "text") {
      const hitText = findTopHit(pt.x, pt.y, { includeImages: false });
      activePointerId = null;
      if (e.pointerType === "pen") activePenPointerId = null;
      if (hitText && hitText.type === "text") {
        openTextEditor(hitText.x, hitText.y, hitText);
      } else {
        openTextEditor(pt.x, pt.y, null);
      }
      return;
    }

    if (currentTool === "pen" || currentTool === "highlighter") {
      selectedId = null;
      updateSelectionBar();
      const size = STROKE_SIZES[currentSizeKey][currentTool];
      const draftItem = {
        id: uid("st"),
        type: "stroke",
        mode: currentTool,
        color: currentColor,
        size,
        points: [[round1(pt.x), round1(pt.y)]],
      };
      interaction = { type: "draw-stroke", draftItem };
      requestRender();
      return;
    }

    if (currentTool === "shape") {
      selectedId = null;
      updateSelectionBar();
      const draftItem = {
        id: uid("sh"),
        type: "shape",
        kind: currentShapeKind,
        color: currentColor,
        size: STROKE_SIZES[currentSizeKey].shape,
        x1: round1(pt.x),
        y1: round1(pt.y),
        x2: round1(pt.x),
        y2: round1(pt.y),
      };
      interaction = { type: "draw-shape", draftItem };
      requestRender();
      return;
    }

    if (currentTool === "eraser") {
      selectedId = null;
      updateSelectionBar();
      eraserCursorWorld = pt;
      dragStartSnapshot = cloneItems(currentItems);
      eraseChanged = false;
      interaction = { type: "erase" };
      eraseAt(pt.x, pt.y);
      requestRender();
      return;
    }

    if (currentTool === "select") {
      // First check resize handles on currently selected item
      if (selectedId) {
        const curSel = currentItems.find((it) => it.id === selectedId);
        if (curSel) {
          const handleId = hitTestCornerHandle(pt.x, pt.y, curSel);
          if (handleId) {
            dragStartSnapshot = cloneItems(currentItems);
            dragMoved = false;
            interaction = {
              type: "resize-item",
              item: curSel,
              handleId,
              orig: curSel.type === "image"
                ? { x: curSel.x, y: curSel.y, w: curSel.w, h: curSel.h }
                : { x1: curSel.x1, y1: curSel.y1, x2: curSel.x2, y2: curSel.y2 },
            };
            requestRender();
            return;
          }
        }
      }

      const hit = findTopHit(pt.x, pt.y, { includeImages: true });
      if (hit) {
        const now = performance.now();
        if (hit.type === "text" && lastClickInfo.itemId === hit.id && now - lastClickInfo.time < 360) {
          lastClickInfo = { time: 0, itemId: null };
          activePointerId = null;
          if (e.pointerType === "pen") activePenPointerId = null;
          openTextEditor(hit.x, hit.y, hit);
          return;
        }
        lastClickInfo = { time: now, itemId: hit.id };
        selectedId = hit.id;
        dragStartSnapshot = cloneItems(currentItems);
        dragMoved = false;
        interaction = {
          type: "drag-item",
          item: hit,
          lastX: pt.x,
          lastY: pt.y,
        };
      } else {
        selectedId = null;
        interaction = null;
      }
      updateSelectionBar();
      requestRender();
    }
  }

  function onCanvasPointerMove(e) {
    const pt = clientToWorld(e.clientX, e.clientY);

    if (currentTool === "eraser") {
      eraserCursorWorld = pt;
      if (!interaction) requestRender();
    } else if (eraserCursorWorld) {
      eraserCursorWorld = null;
      requestRender();
    }

    if (e.pointerId !== activePointerId || !interaction) return;

    if (interaction.type === "draw-stroke") {
      const pts = interaction.draftItem.points;
      const last = pts[pts.length - 1];
      if (Math.hypot(pt.x - last[0], pt.y - last[1]) >= 2) {
        pts.push([round1(pt.x), round1(pt.y)]);
        requestRender();
      }
      return;
    }

    if (interaction.type === "draw-shape") {
      interaction.draftItem.x2 = round1(pt.x);
      interaction.draftItem.y2 = round1(pt.y);
      requestRender();
      return;
    }

    if (interaction.type === "erase") {
      eraseAt(pt.x, pt.y);
      requestRender();
      return;
    }

    if (interaction.type === "drag-item") {
      const dx = pt.x - interaction.lastX;
      const dy = pt.y - interaction.lastY;
      if (Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2) {
        moveItemBy(interaction.item, dx, dy);
        interaction.lastX = pt.x;
        interaction.lastY = pt.y;
        dragMoved = true;
        requestRender();
      }
      return;
    }

    if (interaction.type === "resize-item") {
      resizeItemTo(interaction, pt.x, pt.y, e.shiftKey);
      dragMoved = true;
      requestRender();
    }
  }

  function onCanvasPointerUp(e) {
    if (e.pointerId !== activePointerId) return;
    activePointerId = null;
    if (e.pointerType === "pen") {
      activePenPointerId = null;
      lastPenTime = performance.now();
    }

    try {
      dom.canvas.releasePointerCapture(e.pointerId);
    } catch {}

    if (!interaction) return;
    const finished = interaction;
    interaction = null;

    if (finished.type === "draw-stroke") {
      pushUndo();
      currentItems.push(finished.draftItem);
      updateEmptyHint();
      scheduleSave();
      requestRender();
      return;
    }

    if (finished.type === "draw-shape") {
      const sh = finished.draftItem;
      if (Math.hypot(sh.x2 - sh.x1, sh.y2 - sh.y1) >= 6) {
        pushUndo();
        currentItems.push(sh);
        updateEmptyHint();
        scheduleSave();
      }
      requestRender();
      return;
    }

    if (finished.type === "erase") {
      if (eraseChanged && dragStartSnapshot) {
        pushUndo(dragStartSnapshot);
        updateEmptyHint();
        scheduleSave();
      }
      dragStartSnapshot = null;
      eraseChanged = false;
      requestRender();
      return;
    }

    if (finished.type === "drag-item" || finished.type === "resize-item") {
      if (dragMoved && dragStartSnapshot) {
        pushUndo(dragStartSnapshot);
        scheduleSave();
      }
      dragStartSnapshot = null;
      dragMoved = false;
      requestRender();
    }
  }

  function eraseAt(wx, wy) {
    // Smart layered eraser: erases strokes, shapes & text ONLY — never erases underlying images
    const hit = findTopHit(wx, wy, { includeImages: false, extraTol: 8 / viewScale });
    if (!hit) return;
    const idx = currentItems.findIndex((it) => it.id === hit.id);
    if (idx !== -1) {
      currentItems.splice(idx, 1);
      eraseChanged = true;
    }
  }

  function resizeItemTo(state, wx, wy, unlockAspect) {
    const { item, handleId, orig } = state;
    const minSize = 40;

    if (item.type === "image") {
      const aspect = orig.w / Math.max(1, orig.h);
      let anchorX, anchorY;
      if (handleId === "se") {
        anchorX = orig.x;
        anchorY = orig.y;
      } else if (handleId === "sw") {
        anchorX = orig.x + orig.w;
        anchorY = orig.y;
      } else if (handleId === "ne") {
        anchorX = orig.x;
        anchorY = orig.y + orig.h;
      } else {
        anchorX = orig.x + orig.w;
        anchorY = orig.y + orig.h;
      }

      let newW = Math.max(minSize, Math.abs(wx - anchorX));
      let newH = Math.max(minSize, Math.abs(wy - anchorY));
      if (!unlockAspect) {
        if (newW / aspect >= newH) {
          newH = newW / aspect;
        } else {
          newW = newH * aspect;
        }
      }

      const newX = handleId.includes("w") ? anchorX - newW : anchorX;
      const newY = handleId.includes("n") ? anchorY - newH : anchorY;
      item.x = round1(newX);
      item.y = round1(newY);
      item.w = round1(newW);
      item.h = round1(newH);
      return;
    }

    if (item.type === "shape") {
      const ox1 = Math.min(orig.x1, orig.x2);
      const oy1 = Math.min(orig.y1, orig.y2);
      const ox2 = Math.max(orig.x1, orig.x2);
      const oy2 = Math.max(orig.y1, orig.y2);

      let nx1 = ox1, ny1 = oy1, nx2 = ox2, ny2 = oy2;
      if (handleId === "nw") { nx1 = Math.min(wx, ox2 - 16); ny1 = Math.min(wy, oy2 - 16); }
      if (handleId === "ne") { nx2 = Math.max(wx, ox1 + 16); ny1 = Math.min(wy, oy2 - 16); }
      if (handleId === "sw") { nx1 = Math.min(wx, ox2 - 16); ny2 = Math.max(wy, oy1 + 16); }
      if (handleId === "se") { nx2 = Math.max(wx, ox1 + 16); ny2 = Math.max(wy, oy1 + 16); }
      item.x1 = round1(nx1);
      item.y1 = round1(ny1);
      item.x2 = round1(nx2);
      item.y2 = round1(ny2);
    }
  }

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  // ============================================================
  // UI Actions & Controls
  // ============================================================

  function deleteSelectedItem() {
    if (!selectedId) return;
    const idx = currentItems.findIndex((it) => it.id === selectedId);
    if (idx === -1) return;
    const removed = currentItems[idx];
    pushUndo();
    currentItems.splice(idx, 1);
    selectedId = null;
    if (removed.type === "image" && removed.assetId) {
      pendingOrphanCleanup = true;
    }
    updateSelectionBar();
    updateEmptyHint();
    scheduleSave();
    requestRender();
  }

  function clearCurrentBoard() {
    commitTextEditor(false);
    if (currentItems.length === 0) return;
    const hasImages = currentItems.some((it) => it.type === "image" && it.assetId);
    pushUndo();
    currentItems = [];
    selectedId = null;
    if (hasImages) pendingOrphanCleanup = true;
    updateSelectionBar();
    updateEmptyHint();
    scheduleSave();
    requestRender();
    notify("🧹 הלוח נוקה (אפשר לשחזר בלחיצה על ביטול / Undo)");
  }

  function setTool(tool) {
    commitTextEditor(true);
    currentTool = tool;
    if (tool !== "select") {
      selectedId = null;
      updateSelectionBar();
    }
    if (tool !== "eraser") {
      eraserCursorWorld = null;
    }

    dom.panel?.querySelectorAll("[data-draw-tool]").forEach((btn) => {
      const isAct = btn.dataset.drawTool === tool;
      btn.classList.toggle("active", isAct);
      btn.setAttribute("aria-pressed", isAct ? "true" : "false");
    });

    if (dom.canvas) {
      dom.canvas.dataset.tool = tool;
    }
    requestRender();
  }

  function setShapeKind(kind) {
    if (!SHAPE_LABELS[kind]) return;
    currentShapeKind = kind;
    dom.shapePopover?.querySelectorAll("[data-shape-kind]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.shapeKind === kind);
    });
    if (dom.shapeToolBtn) {
      dom.shapeToolBtn.title = `צורה: ${SHAPE_LABELS[kind]} (לחץ לבחירת צורה)`;
      dom.shapeToolBtn.dataset.activeShape = kind;
    }
    setTool("shape");
    closePopovers();
  }

  function setColor(hex) {
    currentColor = hex;
    dom.panel?.querySelectorAll("[data-draw-color]").forEach((btn) => {
      const isAct = btn.dataset.drawColor === hex;
      btn.classList.toggle("active", isAct);
      btn.setAttribute("aria-pressed", isAct ? "true" : "false");
    });
    if (editingText && dom.textEditor) {
      editingText.color = hex;
      dom.textEditor.style.color = hex;
    }
  }

  function setSize(sizeKey) {
    if (!STROKE_SIZES[sizeKey]) return;
    currentSizeKey = sizeKey;
    dom.panel?.querySelectorAll("[data-draw-size]").forEach((btn) => {
      const isAct = btn.dataset.drawSize === sizeKey;
      btn.classList.toggle("active", isAct);
      btn.setAttribute("aria-pressed", isAct ? "true" : "false");
    });
  }

  function toggleGrid() {
    currentBgGrid = !currentBgGrid;
    saveDefaultGridPref(currentBgGrid);
    updateGridButtonUI();
    if (currentItems.length > 0) {
      scheduleSave();
    }
    requestRender();
  }

  function updateGridButtonUI() {
    if (!dom.btnGrid) return;
    dom.btnGrid.classList.toggle("active", currentBgGrid);
    dom.btnGrid.setAttribute("aria-pressed", currentBgGrid ? "true" : "false");
  }

  function updateSelectionBar() {
    if (!dom.selectionBar) return;
    const sel = selectedId ? currentItems.find((it) => it.id === selectedId) : null;
    dom.selectionBar.classList.toggle("hidden", !sel);
    if (dom.btnEditSelectedText) {
      dom.btnEditSelectedText.classList.toggle("hidden", !sel || sel.type !== "text");
    }
  }

  function updateEmptyHint() {
    if (!dom.emptyHint) return;
    dom.emptyHint.classList.toggle("hidden", currentItems.length > 0);
  }

  function updateTabBadges() {
    const qHas = Boolean(activeQuestion?.id && savedBoardKeys.has(`q:${activeQuestion.id}`));
    const sHas = savedBoardKeys.has("scratchpad");
    dom.tabQuestionDot?.classList.toggle("hidden", !qHas);
    dom.tabScratchDot?.classList.toggle("hidden", !sHas);
  }

  function updateQuestionControlsUI() {
    const hasQ = Boolean(activeQuestion?.id);
    const images = Array.isArray(activeQuestion?.images) ? activeQuestion.images : [];

    if (dom.tabQuestion) {
      dom.tabQuestion.disabled = !hasQ;
      const qShort = hasQ && activeQuestion.num ? `שאלה ${activeQuestion.num}` : "לשאלה זו";
      if (dom.tabQuestionLabel) dom.tabQuestionLabel.textContent = qShort;
    }

    if (dom.btnImportQImg) {
      dom.btnImportQImg.classList.toggle("hidden", images.length === 0);
      dom.btnImportQImg.title =
        images.length > 1
          ? `העבר תמונה מהשאלה ללוח (${images.length} תמונות זמינות)`
          : "העבר את תמונת השאלה ללוח לסימון ישיר";
    }
    updateTabBadges();
  }

  function setTab(tab) {
    if (tab !== "question" && tab !== "scratchpad") return;
    if (tab === "question" && !activeQuestion?.id) return;
    activeTab = tab;
    dom.tabQuestion?.classList.toggle("active", tab === "question");
    dom.tabScratch?.classList.toggle("active", tab === "scratchpad");
    dom.tabQuestion?.setAttribute("aria-selected", tab === "question" ? "true" : "false");
    dom.tabScratch?.setAttribute("aria-selected", tab === "scratchpad" ? "true" : "false");
    closePopovers();
    loadBoard(getTargetBoardKey());
  }

  function closePopovers() {
    dom.shapePopover?.classList.add("hidden");
    dom.qImgPopover?.classList.add("hidden");
  }

  function handleImportQImgClick() {
    const images = Array.isArray(activeQuestion?.images) ? activeQuestion.images : [];
    if (images.length === 0) return;
    if (images.length === 1) {
      closePopovers();
      importQuestionImage(images[0], `${activeQuestion.exam || ""} · שאלה ${activeQuestion.num || ""}`);
      return;
    }
    // Multiple images: render compact picker popover
    if (!dom.qImgPopover) return;
    const isHidden = dom.qImgPopover.classList.contains("hidden");
    closePopovers();
    if (!isHidden) return;

    dom.qImgPopover.innerHTML = "";
    images.forEach((src, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "drawboard-qimg-option";
      btn.innerHTML = `<img src="${src}" alt="תמונה ${idx + 1}" /><span>תמונה ${idx + 1}</span>`;
      btn.onclick = () => {
        closePopovers();
        importQuestionImage(src, `${activeQuestion.exam || ""} · שאלה ${activeQuestion.num || ""} · תמונה ${idx + 1}`);
      };
      dom.qImgPopover.appendChild(btn);
    });
    dom.qImgPopover.classList.remove("hidden");
  }

  // ============================================================
  // Panel Open / Close / Resizing
  // ============================================================

  function applySavedWidth() {
    let w = DEFAULT_PANEL_WIDTH;
    try {
      const stored = parseInt(localStorage.getItem(WIDTH_STORAGE_KEY), 10);
      if (Number.isFinite(stored) && stored >= MIN_PANEL_WIDTH && stored <= 780) {
        w = stored;
      }
    } catch {}
    document.documentElement.style.setProperty("--drawboard-width", `${w}px`);
  }

  function syncVisibilityUI() {
    const visible = isVisiblyOpen();
    document.body.classList.toggle("drawboard-open", visible);
    dom.panel?.classList.toggle("hidden", !visible);
    dom.resizer?.classList.toggle("hidden", !visible);
    dom.backdrop?.classList.toggle("hidden", !visible || !isMobileLayout());

    if (visible) {
      syncTopbarOffset();
      const targetKey = getTargetBoardKey();
      if (currentBoardKey !== targetKey) {
        loadBoard(targetKey);
      }
      requestAnimationFrame(() => {
        updateCanvasMetrics();
        requestRender();
      });
    } else {
      closePopovers();
      commitTextEditor(true);
      flushSave();
    }

    emitStateChange();
  }

  function open() {
    if (!isAvailable) return;
    userWantsOpen = true;
    syncVisibilityUI();
  }

  function close() {
    userWantsOpen = false;
    syncVisibilityUI();
  }

  function toggle() {
    if (isVisiblyOpen()) close();
    else open();
  }

  function setAvailable(available) {
    const next = Boolean(available);
    if (isAvailable === next) return;
    isAvailable = next;
    syncVisibilityUI();
  }

  function setActiveQuestion(questionOrNull) {
    const prevId = activeQuestion?.id || null;
    const nextId = questionOrNull?.id || null;
    activeQuestion = questionOrNull || null;

    if (!nextId && activeTab === "question") {
      // Temporarily show scratchpad if no question is active
      if (isVisiblyOpen() && currentBoardKey !== "scratchpad") {
        loadBoard("scratchpad");
      }
    } else if (nextId !== prevId && activeTab === "question" && isVisiblyOpen()) {
      loadBoard(`q:${nextId}`);
    }

    updateQuestionControlsUI();
    emitStateChange();
  }

  function hasSavedBoard(qId) {
    if (!qId) return false;
    return savedBoardKeys.has(`q:${qId}`);
  }

  function handleEscape() {
    if (!isVisiblyOpen()) return false;

    if (editingText) {
      commitTextEditor(false);
      return true;
    }
    if (
      (dom.shapePopover && !dom.shapePopover.classList.contains("hidden")) ||
      (dom.qImgPopover && !dom.qImgPopover.classList.contains("hidden"))
    ) {
      closePopovers();
      return true;
    }
    if (selectedId) {
      selectedId = null;
      updateSelectionBar();
      requestRender();
      return true;
    }
    if (isMobileLayout()) {
      close();
      return true;
    }
    return false;
  }

  // ============================================================
  // Resizer & Global Clipboard / Drag-Drop / Shortcuts
  // ============================================================

  function initResizer() {
    if (!dom.resizer || !dom.panel) return;
    let dragging = false;
    let startX = 0;
    let startWidth = DEFAULT_PANEL_WIDTH;
    let panelOnLeft = true;

    dom.resizer.addEventListener("pointerdown", (e) => {
      if (isMobileLayout()) return;
      dragging = true;
      startX = e.clientX;
      const panelRect = dom.panel.getBoundingClientRect();
      startWidth = panelRect.width || DEFAULT_PANEL_WIDTH;
      const primary = document.querySelector(".workspace-primary");
      panelOnLeft = primary ? panelRect.left < primary.getBoundingClientRect().left : true;
      dom.resizer.classList.add("dragging");
      document.body.classList.add("drawboard-resizing");
      try {
        dom.resizer.setPointerCapture(e.pointerId);
      } catch {}
    });

    dom.resizer.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const delta = panelOnLeft ? e.clientX - startX : startX - e.clientX;
      const maxW = Math.min(780, Math.round(window.innerWidth * 0.56));
      const nextW = Math.max(MIN_PANEL_WIDTH, Math.min(maxW, Math.round(startWidth + delta)));
      document.documentElement.style.setProperty("--drawboard-width", `${nextW}px`);
      updateCanvasMetrics();
    });

    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      dom.resizer.classList.remove("dragging");
      document.body.classList.remove("drawboard-resizing");
      const curW = Math.round(dom.panel.getBoundingClientRect().width);
      if (curW >= MIN_PANEL_WIDTH) {
        try {
          localStorage.setItem(WIDTH_STORAGE_KEY, String(curW));
        } catch {}
      }
      updateCanvasMetrics();
    };

    dom.resizer.addEventListener("pointerup", endDrag);
    dom.resizer.addEventListener("pointercancel", endDrag);
    dom.resizer.addEventListener("dblclick", () => {
      document.documentElement.style.setProperty("--drawboard-width", `${DEFAULT_PANEL_WIDTH}px`);
      try {
        localStorage.setItem(WIDTH_STORAGE_KEY, String(DEFAULT_PANEL_WIDTH));
      } catch {}
      updateCanvasMetrics();
    });
  }

  function bindEvents() {
    // Tabs
    dom.tabQuestion?.addEventListener("click", () => setTab("question"));
    dom.tabScratch?.addEventListener("click", () => setTab("scratchpad"));
    dom.btnClose?.addEventListener("click", close);
    dom.backdrop?.addEventListener("click", close);

    // Tool buttons
    dom.panel?.querySelectorAll("[data-draw-tool]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tool = btn.dataset.drawTool;
        if (tool === "shape") {
          e.stopPropagation();
          const wasOpen = dom.shapePopover && !dom.shapePopover.classList.contains("hidden");
          closePopovers();
          if (currentTool === "shape" && !wasOpen) {
            dom.shapePopover?.classList.remove("hidden");
          } else {
            setTool("shape");
            if (!wasOpen) dom.shapePopover?.classList.remove("hidden");
          }
          return;
        }
        closePopovers();
        setTool(tool);
      });
    });

    dom.shapePopover?.querySelectorAll("[data-shape-kind]").forEach((btn) => {
      btn.addEventListener("click", () => setShapeKind(btn.dataset.shapeKind));
    });

    // Colors
    dom.panel?.querySelectorAll("[data-draw-color]").forEach((btn) => {
      btn.addEventListener("click", () => setColor(btn.dataset.drawColor));
    });

    // Sizes
    dom.panel?.querySelectorAll("[data-draw-size]").forEach((btn) => {
      btn.addEventListener("click", () => setSize(btn.dataset.drawSize));
    });

    // Actions
    dom.btnGrid?.addEventListener("click", toggleGrid);
    dom.btnUndo?.addEventListener("click", undo);
    dom.btnRedo?.addEventListener("click", redo);
    dom.btnClear?.addEventListener("click", clearCurrentBoard);
    dom.btnDeleteSelected?.addEventListener("click", deleteSelectedItem);
    dom.btnEditSelectedText?.addEventListener("click", () => {
      const sel = currentItems.find((it) => it.id === selectedId && it.type === "text");
      if (sel) openTextEditor(sel.x, sel.y, sel);
    });

    // Image upload & question image import
    dom.btnUploadImg?.addEventListener("click", () => {
      closePopovers();
      dom.fileInput?.click();
    });
    dom.fileInput?.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      e.target.value = "";
      for (const f of files) {
        await addUploadedImageFile(f);
      }
    });
    dom.btnImportQImg?.addEventListener("click", (e) => {
      e.stopPropagation();
      handleImportQImgClick();
    });

    // Text editor controls
    dom.btnTextConfirm?.addEventListener("click", () => commitTextEditor(true));
    dom.btnTextCancel?.addEventListener("click", () => commitTextEditor(false));
    dom.textEditor?.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        commitTextEditor(false);
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        commitTextEditor(true);
      }
    });

    // Canvas pointer events
    dom.canvas?.addEventListener("pointerdown", onCanvasPointerDown);
    dom.canvas?.addEventListener("pointermove", onCanvasPointerMove);
    dom.canvas?.addEventListener("pointerup", onCanvasPointerUp);
    dom.canvas?.addEventListener("pointercancel", onCanvasPointerUp);
    dom.canvas?.addEventListener("pointerleave", () => {
      if (eraserCursorWorld && !interaction) {
        eraserCursorWorld = null;
        requestRender();
      }
    });

    // Drag & Drop images onto stage
    dom.stage?.addEventListener("dragover", (e) => {
      e.preventDefault();
      dom.stage.classList.add("drag-over");
    });
    dom.stage?.addEventListener("dragleave", (e) => {
      if (!dom.stage.contains(e.relatedTarget)) {
        dom.stage.classList.remove("drag-over");
      }
    });
    dom.stage?.addEventListener("drop", async (e) => {
      e.preventDefault();
      dom.stage.classList.remove("drag-over");
      const files = Array.from(e.dataTransfer?.files || []).filter((f) => f.type.startsWith("image/"));
      for (const f of files) {
        await addUploadedImageFile(f);
      }
    });

    // Clipboard Paste (Ctrl+V) of screenshots/images while panel is open
    document.addEventListener("paste", async (e) => {
      if (!isVisiblyOpen()) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const items = Array.from(e.clipboardData?.items || []);
      const imgItems = items.filter((it) => it.kind === "file" && it.type.startsWith("image/"));
      if (imgItems.length === 0) return;
      e.preventDefault();
      for (const it of imgItems) {
        const f = it.getAsFile();
        if (f) await addUploadedImageFile(f);
      }
    });

    // Keyboard shortcuts inside DrawBoard (Undo/Redo/Delete selected)
    document.addEventListener("keydown", (e) => {
      if (!isVisiblyOpen()) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        deleteSelectedItem();
      }
    });

    // Close popovers on outside click
    document.addEventListener("click", (e) => {
      if (!isVisiblyOpen()) return;
      if (dom.shapePopover && !dom.shapePopover.contains(e.target) && !dom.shapeToolBtn?.contains(e.target)) {
        dom.shapePopover.classList.add("hidden");
      }
      if (dom.qImgPopover && !dom.qImgPopover.contains(e.target) && !dom.btnImportQImg?.contains(e.target)) {
        dom.qImgPopover.classList.add("hidden");
      }
    });

    // ResizeObserver for crisp HiDPI updates & topbar height changes
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        if (isVisiblyOpen()) updateCanvasMetrics();
      });
      if (dom.stage) ro.observe(dom.stage);
      const topbar = document.querySelector(".topbar");
      if (topbar) ro.observe(topbar);
    }
    window.addEventListener("resize", () => {
      if (isVisiblyOpen()) {
        dom.backdrop?.classList.toggle("hidden", !isMobileLayout());
        updateCanvasMetrics();
      }
    });

    // Flush save on page hide / tab background
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        commitTextEditor(true);
        flushSave();
      }
    });
    window.addEventListener("pagehide", () => {
      commitTextEditor(true);
      flushSave();
    });
  }

  // ============================================================
  // Init
  // ============================================================

  function init(options = {}) {
    if (initialized) return;
    initialized = true;

    onStateChangeCb = options.onStateChange || null;
    getActiveQuestionCb = options.getActiveQuestion || null;
    showToastCb = options.showToast || null;

    dom.panel = $("drawboardPanel");
    dom.resizer = $("drawboardResizer");
    dom.backdrop = $("drawboardBackdrop");
    dom.stage = $("drawboardStage");
    dom.canvas = $("drawboardCanvas");
    dom.emptyHint = $("drawboardEmptyHint");
    dom.saveStatus = $("drawboardSaveStatus");
    dom.tabQuestion = $("btnDrawTabQuestion");
    dom.tabQuestionLabel = $("drawTabQuestionLabel");
    dom.tabQuestionDot = $("drawTabQuestionDot");
    dom.tabScratch = $("btnDrawTabScratchpad");
    dom.tabScratchDot = $("drawTabScratchDot");
    dom.btnClose = $("btnCloseDrawboard");
    dom.shapeToolBtn = $("btnDrawToolShape");
    dom.shapePopover = $("drawboardShapePopover");
    dom.btnUploadImg = $("btnDrawUploadImg");
    dom.fileInput = $("drawboardImageInput");
    dom.btnImportQImg = $("btnDrawImportQImg");
    dom.qImgPopover = $("drawboardQImgPopover");
    dom.btnGrid = $("btnDrawToggleGrid");
    dom.btnUndo = $("btnDrawUndo");
    dom.btnRedo = $("btnDrawRedo");
    dom.btnClear = $("btnDrawClear");
    dom.selectionBar = $("drawboardSelectionBar");
    dom.btnEditSelectedText = $("btnDrawEditSelectedText");
    dom.btnDeleteSelected = $("btnDrawDeleteSelected");
    dom.textEditorWrap = $("drawboardTextEditorWrap");
    dom.textEditor = $("drawboardTextEditor");
    dom.btnTextConfirm = $("btnDrawTextConfirm");
    dom.btnTextCancel = $("btnDrawTextCancel");

    if (!dom.panel || !dom.canvas) return;

    applySavedWidth();
    currentBgGrid = loadDefaultGridPref();
    updateGridButtonUI();
    setTool("pen");
    setColor("#111827");
    setSize("md");
    initResizer();
    bindEvents();

    if (typeof getActiveQuestionCb === "function") {
      activeQuestion = getActiveQuestionCb() || null;
    }
    updateQuestionControlsUI();
    refreshSavedKeysIndex();
  }

  window.MikbatzDrawBoard = {
    init,
    setActiveQuestion,
    setAvailable,
    toggle,
    open,
    close,
    isOpen: isVisiblyOpen,
    importQuestionImage,
    hasSavedBoard,
    handleEscape,
  };
})();
