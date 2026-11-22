/**
 * Verificación del codificador de QR.
 *
 * 1) Decodifica con un lector independiente (`jsqr`) cada código generado,
 *    comprobando que devuelve exactamente el texto original. Esto valida
 *    modo, corrección de errores, intercalado, máscaras y colocación.
 * 2) Comprueba la matriz de módulos contra una implementación de referencia
 *    (`qrcode`), forzando comparables las condiciones de entrada.
 *
 *   node test/qr.test.js
 *
 * Las dependencias de prueba son opcionales: si no están instaladas, el test
 * de decodificación se omite y el resto sigue siendo válido.
 */
import { encodeQR } from '../server/qr.js';

let jsQR = null;
try {
  const mod = await import('/tmp/qrref/node_modules/jsqr/dist/jsQR.js');
  jsQR = mod.default || mod;
} catch {
  console.log('· jsqr no disponible: se omite la verificación por decodificación.');
}

/* ------------------------------------------------------------------ *
 * 1. Decodificación con lector independiente
 * ------------------------------------------------------------------ */

function rasterize(qr, scale = 4, quiet = 4) {
  const size = (qr.size + quiet * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (!qr.modules[r][c]) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const y = (r + quiet) * scale + dy;
          const x = (c + quiet) * scale + dx;
          const i = (y * size + x) * 4;
          data[i] = 0x00;
          data[i + 1] = 0x54;
          data[i + 2] = 0x87;
          data[i + 3] = 255;
        }
      }
    }
  }
  return { data, width: size, height: size };
}

const textos = [
  'https://taller4.ejemplo.es',
  'https://app-entidades-seguras.ejemplo.es/app?sesion=2026',
  'A',
  'https://redsolidaria.santander.com/encuentro/taller-4',
  'x'.repeat(50),
  'x'.repeat(100),
  'x'.repeat(150),
  'x'.repeat(200),
  'x'.repeat(250),
  'https://ejemplo.es/ruta/muy/larga/con-muchos-caracteres-que-llega-casi-al-limite-del-nivel-M/1234567890',
  'Acentuación y ñ: Entidades seguras en un mundo digital',
  'https://taller4.ejemplo.es/?mesa=1&caso=2'
];

let fallos = 0;

if (jsQR) {
  for (const ecc of ['L', 'M']) {
    for (const texto of textos) {
      let qr;
      try {
        qr = encodeQR(texto, { ecc });
      } catch (err) {
        console.error(`✗ [${ecc}] no se pudo generar: ${err.message}`);
        fallos++;
        continue;
      }
      const img = rasterize(qr);
      const res = jsQR(img.data, img.width, img.height);
      if (!res) {
        console.error(`✗ [${ecc}] decodificación fallida (v${qr.version}) "${texto.slice(0, 30)}…"`);
        fallos++;
      } else if (res.data !== texto) {
        console.error(`✗ [${ecc}] texto distinto (v${qr.version})`);
        console.error(`   esperado: ${texto}`);
        console.error(`   obtenido: ${res.data}`);
        fallos++;
      } else {
        console.log(`✓ [${ecc}] v${String(qr.version).padStart(2)} decodificado — "${texto.slice(0, 38)}…"`);
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * 2. Comparación de matriz con la referencia
 * ------------------------------------------------------------------ */

let QRCode = null;
try {
  const mod = await import('/tmp/qrref/node_modules/qrcode/lib/index.js');
  QRCode = mod.default || mod;
} catch {
  console.log('· qrcode no disponible: se omite la comparación de matriz.');
}

if (QRCode) {
  // La referencia optimiza el modo de codificación y elige máscara con su
  // propio criterio de penalización. Para que la comparación seabit a bit se
  // recorta el texto a caracteres no optimizables (así la referencia también
  // usa modo byte) y se fuerza la misma máscara que ha elegido la referencia.
  const soloByte = (t) => t.replace(/[A-Z0-9 $%*+\-./:]/g, 'a');
  const maskDeReferencia = (mat, n) => {
    const bits = [];
    for (let i = 0; i <= 5; i++) bits[i] = mat[i][8];
    bits[6] = mat[7][8];
    bits[7] = mat[8][8];
    bits[8] = mat[8][7];
    for (let i = 9; i < 15; i++) bits[i] = mat[8][14 - i];
    let v = 0;
    for (let i = 0; i < 15; i++) if (bits[i]) v |= 1 << i;
    return ((v ^ 0x5412) >>> 10) & 7;
  };

  for (const ecc of ['L', 'M']) {
    for (const original of textos) {
      const texto = soloByte(original);
      const ref = QRCode.create(texto, { errorCorrectionLevel: ecc });
      const n = ref.modules.size;
      const mat = [];
      for (let r = 0; r < n; r++) {
        const row = [];
        for (let c = 0; c < n; c++) row.push(ref.modules.data[r * n + c] === 1);
        mat.push(row);
      }
      const mask = maskDeReferencia(mat, n);
      const mine = encodeQR(texto, { ecc, mask });
      if (mine.size !== n) {
        console.error(`✗ [ref ${ecc}] tamaño ${mine.size} vs ${n}`);
        fallos++;
        continue;
      }
      let diff = 0;
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (mat[r][c] !== mine.modules[r][c]) diff++;
        }
      }
      if (diff !== 0) {
        console.error(`✗ [ref ${ecc}] "${texto.slice(0, 24)}…" → ${diff} módulos distintos (mask ${mask})`);
        fallos++;
      } else {
        console.log(`✓ [ref ${ecc}] matriz idéntica a la referencia (v${mine.version}, mask ${mask})`);
      }
    }
  }
}

console.log(fallos === 0 ? '\nTodo correcto.' : `\n${fallos} fallos.`);
process.exit(fallos === 0 ? 0 : 1);
