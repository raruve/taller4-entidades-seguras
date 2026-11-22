/**
 * Codificador de códigos QR (modelo 2) sin dependencias externas.
 *
 * Modo byte, niveles de corrección de error L y M, versiones 1 a 15.
 * La app no puede depender de un servicio de terceros para mostrar el QR de
 * acceso, así que la implementación es local y verificable (ver test/qr.test.js,
 * que contrasta el resultado con una implementación de referencia).
 *
 * Referencia: ISO/IEC 18004. Estructura siguiendo el flujo habitual
 * (datos → bloques + Reed-Solomon → intercalado → patrones de función →
 * máscara).
 */
import zlib from 'node:zlib';

/* ------------------------------------------------------------------ *
 * Tablas del estándar
 * ------------------------------------------------------------------ */

// Nivel de corrección: L = 0b01, M = 0b00, Q = 0b11, H = 0b10.
const ECC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

// Código dewords totales por versión.
const TOTAL_CODEWORDS = {
  1: 26, 2: 44, 3: 70, 4: 100, 5: 134, 6: 172, 7: 196, 8: 242, 9: 292, 10: 346,
  11: 404, 12: 466, 13: 532, 14: 581, 15: 655
};

// [bloques grupo 1, codewords de datos por bloque grupo 1,
//  bloques grupo 2, codewords de datos por bloque grupo 2,
//  codewords de corrección por bloque]
const ECC_TABLE = {
  L: {
    1: [1, 19, 0, 0, 7],
    2: [1, 34, 0, 0, 10],
    3: [1, 55, 0, 0, 15],
    4: [1, 80, 0, 0, 20],
    5: [1, 108, 0, 0, 26],
    6: [2, 68, 0, 0, 18],
    7: [2, 78, 0, 0, 20],
    8: [2, 97, 0, 0, 24],
    9: [2, 116, 0, 0, 30],
    10: [2, 68, 2, 69, 18],
    11: [4, 81, 0, 0, 20],
    12: [2, 92, 2, 93, 24],
    13: [4, 107, 0, 0, 26],
    14: [3, 115, 1, 116, 30],
    15: [5, 87, 1, 88, 22]
  },
  M: {
    1: [1, 16, 0, 0, 10],
    2: [1, 28, 0, 0, 16],
    3: [1, 44, 0, 0, 26],
    4: [2, 32, 0, 0, 18],
    5: [2, 43, 0, 0, 24],
    6: [4, 27, 0, 0, 16],
    7: [4, 31, 0, 0, 18],
    8: [2, 38, 2, 39, 22],
    9: [3, 36, 2, 37, 22],
    10: [4, 43, 1, 44, 26],
    11: [1, 50, 4, 51, 30],
    12: [6, 36, 2, 37, 22],
    13: [8, 37, 1, 38, 22],
    14: [4, 40, 5, 41, 24],
    15: [5, 41, 5, 42, 24]
  }
};

/* ------------------------------------------------------------------ *
 * Aritmética de Galois GF(256)
 * ------------------------------------------------------------------ */

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

/** Polinomio generador de Reed-Solomon de grado `degree`. */
function rsGeneratorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
    }
    poly = next;
  }
  return poly;
}

/** Codewords de corrección de error para un bloque de datos. */
function rsComputeRemainder(data, degree) {
  const gen = rsGeneratorPoly(degree);
  const result = new Uint8Array(degree);
  for (const byte of data) {
    const factor = byte ^ result[0];
    result.copyWithin(0, 1);
    result[degree - 1] = 0;
    for (let i = 0; i < degree; i++) {
      result[i] ^= gfMul(gen[i + 1], factor);
    }
  }
  return result;
}

/* ------------------------------------------------------------------ *
 * Codificación
 * ------------------------------------------------------------------ */

function utf8Bytes(text) {
  return Array.from(Buffer.from(text, 'utf8'));
}

/** Número de bits de datos disponibles por versión y nivel. */
function dataCodewords(version, ecc) {
  const [g1, d1, g2, d2] = ECC_TABLE[ecc][version];
  return g1 * d1 + g2 * d2;
}

/** Selecciona la versión más pequeña que admite el texto. */
function chooseVersion(byteLength, ecc) {
  for (let v = 1; v <= 15; v++) {
    const capacityBits = dataCodewords(v, ecc) * 8;
    const countBits = v <= 9 ? 8 : 16;
    const needed = 4 + countBits + byteLength * 8;
    if (needed <= capacityBits) return v;
  }
  throw new Error('Contenido demasiado largo para un código QR de esta versión');
}

/** Flujo de bits: modo, longitud, datos, terminador y relleno. */
function buildDataBits(bytes, version, ecc) {
  const bits = [];
  const push = (value, length) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };

  push(0b0100, 4); // modo byte
  push(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) push(b, 8);

  const capacityBits = dataCodewords(version, ecc) * 8;
  push(0, Math.min(4, capacityBits - bits.length)); // terminador
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  // Relleno alterno 0xEC / 0x11.
  const total = dataCodewords(version, ecc);
  let pad = 0;
  while (codewords.length < total) {
    codewords.push(pad % 2 === 0 ? 0xec : 0x11);
    pad++;
  }
  return codewords;
}

/** Divide en bloques, calcula Reed-Solomon e intercala. */
function interleave(codewords, version, ecc) {
  const [g1, d1, g2, d2, ecLen] = ECC_TABLE[ecc][version];
  const numBlocks = g1 + g2;
  const dataLens = [];
  for (let i = 0; i < numBlocks; i++) dataLens.push(i < g1 ? d1 : d2);

  const blocks = [];
  let offset = 0;
  for (const len of dataLens) {
    const data = codewords.slice(offset, offset + len);
    offset += len;
    const eccBytes = Array.from(rsComputeRemainder(data, ecLen));
    blocks.push({ data, ecc: eccBytes });
  }

  const result = [];
  const maxData = Math.max(...dataLens);
  for (let i = 0; i < maxData; i++) {
    for (const b of blocks) if (i < b.data.length) result.push(b.data[i]);
  }
  for (let i = 0; i < ecLen; i++) {
    for (const b of blocks) result.push(b.ecc[i]);
  }
  return result;
}

/* ------------------------------------------------------------------ *
 * Matriz de módulos
 * ------------------------------------------------------------------ */

function maskCondition(mask, row, col) {
  switch (mask) {
    case 0: return (row + col) % 2 === 0;
    case 1: return row % 2 === 0;
    case 2: return col % 3 === 0;
    case 3: return (row + col) % 3 === 0;
    case 4: return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5: return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6: return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    case 7: return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
    default: throw new Error('Máscara no válida');
  }
}

function alignmentPositions(version) {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const step = Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const size = version * 4 + 17;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

class Matrix {
  constructor(size) {
    this.size = size;
    this.modules = Array.from({ length: size }, () => new Array(size).fill(false));
    this.isFunction = Array.from({ length: size }, () => new Array(size).fill(false));
  }
  set(row, col, dark, isFn = true) {
    this.modules[row][col] = dark;
    if (isFn) this.isFunction[row][col] = true;
  }
  get(row, col) {
    return this.modules[row][col];
  }
}

function drawFinder(m, rowCenter, colCenter) {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const row = rowCenter + dy;
      const col = colCenter + dx;
      if (row < 0 || row >= m.size || col < 0 || col >= m.size) continue;
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      m.set(row, col, dist !== 2 && dist !== 4);
    }
  }
}

function drawAlignment(m, rowCenter, colCenter) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      m.set(rowCenter + dy, colCenter + dx, dist !== 1);
    }
  }
}

function drawFunctionPatterns(m, version) {
  // Patrones de temporización.
  for (let i = 0; i < m.size; i++) {
    m.set(i, 6, i % 2 === 0);
    m.set(6, i, i % 2 === 0);
  }
  // Localizadores (3 esquinas) con sus separadores.
  drawFinder(m, 3, 3);
  drawFinder(m, 3, m.size - 4);
  drawFinder(m, m.size - 4, 3);
  // Patrones de alineación, salvo los que pisan localizadores.
  const positions = alignmentPositions(version);
  const last = positions.length - 1;
  for (let i = 0; i < positions.length; i++) {
    for (let j = 0; j < positions.length; j++) {
      const isCorner =
        (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0);
      if (isCorner) continue;
      drawAlignment(m, positions[i], positions[j]);
    }
  }
  // Módulo oscuro fijo.
  m.set(m.size - 8, 8, true);
}

function drawFormatBits(m, ecc, mask) {
  const data = (ECC_FORMAT_BITS[ecc] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = (i) => ((bits >>> i) & 1) !== 0;

  // Copia 1, alrededor del localizador superior izquierdo.
  for (let i = 0; i <= 5; i++) m.set(i, 8, bit(i));
  m.set(7, 8, bit(6));
  m.set(8, 8, bit(7));
  m.set(8, 7, bit(8));
  for (let i = 9; i < 15; i++) m.set(8, 14 - i, bit(i));

  // Copia 2, repartida entre los otros dos localizadores.
  for (let i = 0; i < 8; i++) m.set(8, m.size - 1 - i, bit(i));
  for (let i = 8; i < 15; i++) m.set(m.size - 15 + i, 8, bit(i));
}

function drawVersionBits(m, version) {
  if (version < 7) return;
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = (version << 12) | rem;
  for (let i = 0; i < 18; i++) {
    const dark = ((bits >>> i) & 1) !== 0;
    const a = m.size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    m.set(b, a, dark);
    m.set(a, b, dark);
  }
}

function placeData(m, codewords, mask) {
  const bits = [];
  for (const cw of codewords) {
    for (let i = 7; i >= 0; i--) bits.push((cw >>> i) & 1);
  }
  let bitIndex = 0;
  let dir = -1;
  let row = m.size - 1;
  // Recorrido en zigzag de dos columnas de ancho, de derecha a izquierda.
  // La columna 6 es de temporización y se salta; al saltarla hay que
  // ajustar el salto para no repetir la columna anterior.
  let colPair = m.size - 1;
  while (colPair > 0) {
    const col = colPair === 6 ? 5 : colPair;
    for (;;) {
      for (let c = 0; c < 2; c++) {
        const cc = col - c;
        if (m.isFunction[row][cc]) continue;
        let dark = bitIndex < bits.length ? bits[bitIndex] === 1 : false;
        bitIndex++;
        if (maskCondition(mask, row, cc)) dark = !dark;
        m.set(row, cc, dark, false);
      }
      row += dir;
      if (row < 0 || row >= m.size) {
        row -= dir;
        dir = -dir;
        break;
      }
    }
    colPair = col - 2;
  }
}

function penalty(m) {
  const size = m.size;
  let score = 0;

  // Regla 1: rachas de 5 o más módulos del mismo color.
  for (let i = 0; i < size; i++) {
    let runColor = m.get(i, 0);
    let runLength = 1;
    for (let j = 1; j < size; j++) {
      const c = m.get(i, j);
      if (c === runColor) {
        runLength++;
        if (runLength === 5) score += 3;
        else if (runLength > 5) score += 1;
      } else {
        runColor = c;
        runLength = 1;
      }
    }
    runColor = m.get(0, i);
    runLength = 1;
    for (let j = 1; j < size; j++) {
      const c = m.get(j, i);
      if (c === runColor) {
        runLength++;
        if (runLength === 5) score += 3;
        else if (runLength > 5) score += 1;
      } else {
        runColor = c;
        runLength = 1;
      }
    }
  }

  // Regla 2: bloques 2x2 del mismo color.
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = m.get(r, c);
      if (v === m.get(r, c + 1) && v === m.get(r + 1, c) && v === m.get(r + 1, c + 1)) score += 3;
    }
  }

  // Regla 3: patrón 1:1:3:1:1 con cuatro módulos claros a un lado.
  const pattern = [true, false, true, true, true, false, true, false, false, false, false];
  const matches = (arr) => {
    let found = 0;
    for (let i = 0; i + 11 <= size; i++) {
      let ok = true;
      for (let j = 0; j < 11; j++) {
        if (arr[i + j] !== pattern[j]) { ok = false; break; }
      }
      if (ok) found++;
    }
    return found;
  };
  for (let i = 0; i < size; i++) {
    const row = [];
    const col = [];
    for (let j = 0; j < size; j++) {
      row.push(m.get(i, j));
      col.push(m.get(j, i));
    }
    score += 40 * (matches(row) + matches(col));
  }

  // Regla 4: desviación respecto al 50 % de módulos oscuros.
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (m.get(r, c)) dark++;
  const total = size * size;
  const percent = (dark * 100) / total;
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

/**
 * Genera la matriz de un código QR.
 * @returns {{size:number, version:number, ecc:string, modules:boolean[][]}}
 */
export function encodeQR(text, options = {}) {
  const ecc = options.ecc || 'M';
  if (!ECC_TABLE[ecc]) throw new Error(`Nivel de corrección no soportado: ${ecc}`);

  const bytes = utf8Bytes(text);
  const version = options.version || chooseVersion(bytes.length, ecc);
  if (version < 1 || version > 15) throw new Error('Versión fuera de rango');
  if (bytes.length > dataCodewords(version, ecc) - (version <= 9 ? 2 : 3)) {
    throw new Error('El contenido no cabe en la versión elegida');
  }

  const codewords = interleave(buildDataBits(bytes, version, ecc), version, ecc);

  let best = null;
  const maskList = options.mask != null ? [options.mask] : [0, 1, 2, 3, 4, 5, 6, 7];
  for (const mask of maskList) {
    const m = new Matrix(version * 4 + 17);
    drawFunctionPatterns(m, version);
    drawVersionBits(m, version);
    // Los módulos de formato se reservan ANTES de colocar los datos (si no,
    // el flujo de datos se escribiría sobre ellos y luego se sobrescribiría).
    drawFormatBits(m, ecc, 0);
    placeData(m, codewords, mask);
    drawFormatBits(m, ecc, mask);
    const score = penalty(m);
    if (!best || score < best.score) best = { score, matrix: m, mask };
  }

  return {
    size: best.matrix.size,
    version,
    ecc,
    mask: best.mask,
    modules: best.matrix.modules
  };
}

/* ------------------------------------------------------------------ *
 * Salida SVG y PNG
 * ------------------------------------------------------------------ */

/** Código QR como SVG (ideal para insertar en la presentación). */
export function qrToSvg(qr, options = {}) {
  const margin = options.margin ?? 4;
  const size = qr.size + margin * 2;
  const path = [];
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (qr.modules[r][c]) path.push(`M${c + margin} ${r + margin}h1v1h-1z`);
    }
  }
  const px = options.scale ?? 8;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size * px}" height="${size * px}" ` +
    `viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" ` +
    `aria-label="Código QR de acceso a la app">` +
    `<rect width="${size}" height="${size}" fill="#ffffff"/>` +
    `<path fill="#005487" d="${path.join('')}"/></svg>`
  );
}

/** PNG mínimo (sin dependencias) para la cartela imprimible y los iconos. */
export function qrToPng(qr, options = {}) {
  const margin = options.margin ?? 4;
  const scale = options.scale ?? 8;
  const size = qr.size + margin * 2;
  const width = size * scale;
  const height = size * scale;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  const dark = [0x00, 0x54, 0x87];
  const light = [0xff, 0xff, 0xff];
  let pos = 0;
  for (let r = 0; r < size; r++) {
    raw[pos++] = 0; // filtro None
    for (let c = 0; c < size; c++) {
      const moduleRow = r - margin;
      const moduleCol = c - margin;
      const on =
        moduleRow >= 0 &&
        moduleRow < qr.size &&
        moduleCol >= 0 &&
        moduleCol < qr.size &&
        qr.modules[moduleRow][moduleCol];
      const color = on ? dark : light;
      for (let i = 0; i < scale; i++) {
        raw[pos++] = color[0];
        raw[pos++] = color[1];
        raw[pos++] = color[2];
      }
    }
  }
  return encodePng(width, height, raw);
}

/* ------------------------------------------------------------------ *
 * PNG
 * ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // profundidad de bits
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/** PNG de un color sólido (para iconos y favicon). */
export function solidPng(width, height, rgb) {
  return pngDesdePixels(width, height, () => rgb);
}

/**
 * PNG a partir de una función de pintado por píxel.
 * @param {(x:number,y:number)=>[number,number,number]} pintar
 */
export function pngDesdePixels(width, height, pintar) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    raw[pos++] = 0; // filtro None
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pintar(x, y);
      raw[pos++] = r;
      raw[pos++] = g;
      raw[pos++] = b;
    }
  }
  return encodePng(width, height, raw);
}
