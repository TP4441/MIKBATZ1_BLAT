/* Offline QR Code SVG generator (ISO/IEC 18004, Versions 1-10, Byte mode, ECC Level M) */
(function (root) {
  "use strict";

  const GF_EXP = new Uint8Array(512);
  const GF_LOG = new Uint8Array(256);
  (function initGalois() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) {
      GF_EXP[i] = GF_EXP[i - 255];
    }
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return GF_EXP[GF_LOG[a] + GF_LOG[b]];
  }

  function rsGeneratorPoly(ecLen) {
    let poly = [1];
    for (let i = 0; i < ecLen; i++) {
      const next = new Array(poly.length + 1).fill(0);
      const factor = GF_EXP[i];
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], factor);
      }
      poly = next;
    }
    return poly;
  }

  function rsComputeEc(data, ecLen) {
    const gen = rsGeneratorPoly(ecLen);
    const res = new Uint8Array(data.length + ecLen);
    res.set(data, 0);
    for (let i = 0; i < data.length; i++) {
      const coef = res[i];
      if (coef !== 0) {
        for (let j = 0; j < gen.length; j++) {
          res[i + j] ^= gfMul(gen[j], coef);
        }
      }
    }
    return res.slice(data.length);
  }

  // Level M table for Versions 1..10: [version, ecPerBlock, g1Count, g1Data, g2Count, g2Data, alignCoords]
  const VERSION_M_SPECS = [
    null,
    [1, 10, 1, 16, 0, 0, []],
    [2, 16, 1, 28, 0, 0, [6, 18]],
    [3, 26, 1, 44, 0, 0, [6, 22]],
    [4, 18, 2, 32, 0, 0, [6, 26]],
    [5, 24, 2, 43, 0, 0, [6, 30]],
    [6, 16, 4, 27, 0, 0, [6, 34]],
    [7, 18, 4, 31, 0, 0, [6, 22, 38]],
    [8, 22, 2, 38, 2, 39, [6, 24, 42]],
    [9, 22, 3, 36, 2, 37, [6, 26, 46]],
    [10, 26, 4, 43, 1, 44, [6, 28, 50]],
  ];

  function encodeUtf8Bytes(str) {
    if (typeof TextEncoder !== "undefined") {
      return Array.from(new TextEncoder().encode(String(str)));
    }
    const out = [];
    const utf8 = unescape(encodeURIComponent(String(str)));
    for (let i = 0; i < utf8.length; i++) out.push(utf8.charCodeAt(i));
    return out;
  }

  function selectVersion(byteLen) {
    for (let v = 1; v < VERSION_M_SPECS.length; v++) {
      const [, , g1c, g1d, g2c, g2d] = VERSION_M_SPECS[v];
      const totalDataBytes = g1c * g1d + g2c * g2d;
      const ccBits = v >= 10 ? 16 : 8;
      const neededBits = 4 + ccBits + byteLen * 8;
      if (neededBits <= totalDataBytes * 8) return v;
    }
    throw new Error("QR payload too long (max 213 bytes)");
  }

  function buildCodewords(bytes, version) {
    const [, ecPerBlock, g1c, g1d, g2c, g2d] = VERSION_M_SPECS[version];
    const totalDataBytes = g1c * g1d + g2c * g2d;
    const bits = [];
    const pushBits = (val, len) => {
      for (let i = len - 1; i >= 0; i--) {
        bits.push((val >>> i) & 1);
      }
    };

    // Byte mode indicator (0100) + character count
    pushBits(0b0100, 4);
    pushBits(bytes.length, version >= 10 ? 16 : 8);
    for (const b of bytes) pushBits(b, 8);

    // Terminator up to 4 zero bits
    const capacityBits = totalDataBytes * 8;
    const termLen = Math.min(4, capacityBits - bits.length);
    for (let i = 0; i < termLen; i++) bits.push(0);

    // Pad to byte boundary
    while (bits.length % 8 !== 0) bits.push(0);

    // Convert to bytes and add pad codewords (0xEC, 0x11)
    const dataBytes = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
      dataBytes.push(byte);
    }
    const padBytes = [0xec, 0x11];
    let padIdx = 0;
    while (dataBytes.length < totalDataBytes) {
      dataBytes.push(padBytes[padIdx % 2]);
      padIdx++;
    }

    // Split into blocks & compute Reed-Solomon ECC
    const blocks = [];
    const ecBlocks = [];
    let offset = 0;
    for (let i = 0; i < g1c; i++) {
      const blk = new Uint8Array(dataBytes.slice(offset, offset + g1d));
      offset += g1d;
      blocks.push(blk);
      ecBlocks.push(rsComputeEc(blk, ecPerBlock));
    }
    for (let i = 0; i < g2c; i++) {
      const blk = new Uint8Array(dataBytes.slice(offset, offset + g2d));
      offset += g2d;
      blocks.push(blk);
      ecBlocks.push(rsComputeEc(blk, ecPerBlock));
    }

    // Interleave data codewords, then ECC codewords
    const finalBytes = [];
    const maxDataLen = Math.max(g1d, g2d);
    for (let i = 0; i < maxDataLen; i++) {
      for (let b = 0; b < blocks.length; b++) {
        if (i < blocks[b].length) finalBytes.push(blocks[b][i]);
      }
    }
    for (let i = 0; i < ecPerBlock; i++) {
      for (let b = 0; b < ecBlocks.length; b++) {
        finalBytes.push(ecBlocks[b][i]);
      }
    }
    return finalBytes;
  }

  function createMatrix(size) {
    const modules = Array.from({ length: size }, () => new Int8Array(size));
    const isFunc = Array.from({ length: size }, () => new Uint8Array(size));
    return { size, modules, isFunc };
  }

  function setFunc(mat, r, c, dark) {
    mat.modules[r][c] = dark ? 1 : 0;
    mat.isFunc[r][c] = 1;
  }

  function drawFinder(mat, top, left) {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = top + dr;
        const c = left + dc;
        if (r < 0 || r >= mat.size || c < 0 || c >= mat.size) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFunc(mat, r, c, inOuter && (onBorder || inInner));
      }
    }
  }

  function drawAlignment(mat, centerR, centerC) {
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
        setFunc(mat, centerR + dr, centerC + dc, dark);
      }
    }
  }

  function setupFunctionPatterns(version) {
    const size = version * 4 + 17;
    const mat = createMatrix(size);

    drawFinder(mat, 0, 0);
    drawFinder(mat, 0, size - 7);
    drawFinder(mat, size - 7, 0);

    // Alignment patterns
    const coords = VERSION_M_SPECS[version][6];
    for (const r of coords) {
      for (const c of coords) {
        if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) {
          continue;
        }
        drawAlignment(mat, r, c);
      }
    }

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
      const dark = i % 2 === 0;
      if (!mat.isFunc[6][i]) setFunc(mat, 6, i, dark);
      if (!mat.isFunc[i][6]) setFunc(mat, i, 6, dark);
    }

    // Dark module
    setFunc(mat, size - 8, 8, true);

    // Reserve format info areas
    for (let i = 0; i < 9; i++) {
      if (i !== 6) {
        if (!mat.isFunc[8][i]) setFunc(mat, 8, i, false);
        if (!mat.isFunc[i][8]) setFunc(mat, i, 8, false);
      }
    }
    for (let i = 0; i < 8; i++) {
      setFunc(mat, 8, size - 1 - i, false);
      if (i < 7) setFunc(mat, size - 1 - i, 8, false);
    }

    // Version info areas for version >= 7
    if (version >= 7) {
      let rem = version;
      for (let i = 0; i < 12; i++) {
        rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      }
      const verBits = (version << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const bit = ((verBits >>> i) & 1) === 1;
        const a = size - 11 + (i % 3);
        const b = Math.floor(i / 3);
        setFunc(mat, a, b, bit);
        setFunc(mat, b, a, bit);
      }
    }

    return mat;
  }

  function placeDataBits(mat, codewords) {
    const bits = [];
    for (const byte of codewords) {
      for (let i = 7; i >= 0; i--) bits.push((byte >>> i) & 1);
    }

    let bitIdx = 0;
    let upward = true;
    for (let right = mat.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5; // skip vertical timing column
      for (let step = 0; step < mat.size; step++) {
        const r = upward ? mat.size - 1 - step : step;
        for (let lr = 0; lr < 2; lr++) {
          const c = right - lr;
          if (!mat.isFunc[r][c]) {
            mat.modules[r][c] = bitIdx < bits.length ? bits[bitIdx++] : 0;
          }
        }
      }
      upward = !upward;
    }
  }

  function applyFormatInfo(mat, maskPattern) {
    // ECC Level M = 0b00
    const data = (0b00 << 3) | maskPattern;
    let rem = data;
    for (let i = 0; i < 10; i++) {
      rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    }
    const formatBits = ((data << 10) | rem) ^ 0x5412;
    const size = mat.size;

    for (let i = 0; i <= 5; i++) setFunc(mat, 8, i, ((formatBits >>> i) & 1) === 1);
    setFunc(mat, 8, 7, ((formatBits >>> 6) & 1) === 1);
    setFunc(mat, 8, 8, ((formatBits >>> 7) & 1) === 1);
    setFunc(mat, 7, 8, ((formatBits >>> 8) & 1) === 1);
    for (let i = 9; i < 15; i++) setFunc(mat, 14 - i, 8, ((formatBits >>> i) & 1) === 1);

    for (let i = 0; i < 8; i++) setFunc(mat, 8, size - 1 - i, ((formatBits >>> i) & 1) === 1);
    for (let i = 8; i < 15; i++) setFunc(mat, size - 15 + i, 8, ((formatBits >>> i) & 1) === 1);
  }

  function maskCondition(mask, r, c) {
    switch (mask) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
      default: return false;
    }
  }

  function cloneWithMask(baseMat, mask) {
    const size = baseMat.size;
    const mat = {
      size,
      isFunc: baseMat.isFunc,
      modules: baseMat.modules.map((row, r) => {
        const copy = new Int8Array(row);
        for (let c = 0; c < size; c++) {
          if (!baseMat.isFunc[r][c] && maskCondition(mask, r, c)) {
            copy[c] ^= 1;
          }
        }
        return copy;
      }),
    };
    applyFormatInfo(mat, mask);
    return mat;
  }

  function computePenalty(mat) {
    const n = mat.size;
    const m = mat.modules;
    let penalty = 0;

    // N1: 5+ consecutive modules in row/col
    for (let r = 0; r < n; r++) {
      let runColor = m[r][0];
      let runLen = 1;
      for (let c = 1; c < n; c++) {
        if (m[r][c] === runColor) {
          runLen++;
        } else {
          if (runLen >= 5) penalty += 3 + (runLen - 5);
          runColor = m[r][c];
          runLen = 1;
        }
      }
      if (runLen >= 5) penalty += 3 + (runLen - 5);
    }
    for (let c = 0; c < n; c++) {
      let runColor = m[0][c];
      let runLen = 1;
      for (let r = 1; r < n; r++) {
        if (m[r][c] === runColor) {
          runLen++;
        } else {
          if (runLen >= 5) penalty += 3 + (runLen - 5);
          runColor = m[r][c];
          runLen = 1;
        }
      }
      if (runLen >= 5) penalty += 3 + (runLen - 5);
    }

    // N2: 2x2 blocks
    for (let r = 0; r < n - 1; r++) {
      for (let c = 0; c < n - 1; c++) {
        const sum = m[r][c] + m[r][c + 1] + m[r + 1][c] + m[r + 1][c + 1];
        if (sum === 0 || sum === 4) penalty += 3;
      }
    }

    // N3: finder-like patterns 10111010000 or 00001011101
    const matchFinderPat = (arr, start) => {
      const a = arr[start] === 1 && arr[start + 1] === 0 && arr[start + 2] === 1 && arr[start + 3] === 1 &&
                arr[start + 4] === 1 && arr[start + 5] === 0 && arr[start + 6] === 1 &&
                arr[start + 7] === 0 && arr[start + 8] === 0 && arr[start + 9] === 0 && arr[start + 10] === 0;
      const b = arr[start] === 0 && arr[start + 1] === 0 && arr[start + 2] === 0 && arr[start + 3] === 0 &&
                arr[start + 4] === 1 && arr[start + 5] === 0 && arr[start + 6] === 1 &&
                arr[start + 7] === 1 && arr[start + 8] === 1 && arr[start + 9] === 0 && arr[start + 10] === 1;
      return a || b;
    };
    const colBuf = new Int8Array(n);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c <= n - 11; c++) {
        if (matchFinderPat(m[r], c)) penalty += 40;
      }
    }
    for (let c = 0; c < n; c++) {
      for (let r = 0; r < n; r++) colBuf[r] = m[r][c];
      for (let r = 0; r <= n - 11; r++) {
        if (matchFinderPat(colBuf, r)) penalty += 40;
      }
    }

    // N4: dark module ratio
    let darkCount = 0;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) darkCount += m[r][c];
    }
    const pct = (darkCount * 100) / (n * n);
    const k = Math.floor(Math.abs(pct - 50) / 5);
    penalty += k * 10;

    return penalty;
  }

  function encodeMatrix(text) {
    const bytes = encodeUtf8Bytes(text);
    const version = selectVersion(bytes.length);
    const codewords = buildCodewords(bytes, version);
    const baseMat = setupFunctionPatterns(version);
    placeDataBits(baseMat, codewords);

    let bestMat = null;
    let bestScore = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      const candidate = cloneWithMask(baseMat, mask);
      const score = computePenalty(candidate);
      if (score < bestScore) {
        bestScore = score;
        bestMat = candidate;
      }
    }
    return { version, size: bestMat.size, modules: bestMat.modules };
  }

  function renderSvg(text, options = {}) {
    const sizePx = Number(options.size) || 220;
    const margin = options.margin !== undefined ? Number(options.margin) : 4;
    const fg = options.fg || "#111827";
    const bg = options.bg || "#FFFFFF";
    const { size, modules } = encodeMatrix(text);
    const viewSize = size + margin * 2;

    const paths = [];
    for (let r = 0; r < size; r++) {
      let c = 0;
      while (c < size) {
        if (modules[r][c] === 1) {
          let run = 1;
          while (c + run < size && modules[r][c + run] === 1) run++;
          paths.push(`M${c + margin} ${r + margin}h${run}v1h-${run}z`);
          c += run;
        } else {
          c++;
        }
      }
    }

    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewSize} ${viewSize}" ` +
      `width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges" role="img" aria-label="קוד QR לסנכרון">` +
      `<rect width="100%" height="100%" fill="${bg}"/>` +
      `<path fill="${fg}" d="${paths.join("")}"/>` +
      `</svg>`
    );
  }

  const api = { encodeMatrix, renderSvg };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.QrSvg = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
