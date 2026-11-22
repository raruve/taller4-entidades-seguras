/**
 * Genera los iconos PNG de la app a partir de la marca del taller.
 * Se ejecuta una sola vez; los PNG resultantes se versionan.
 *
 *   node tools/generar-iconos.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pngDesdePixels } from '../server/qr.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESTINO = path.join(__dirname, '..', 'public', 'assets');

const AZUL = [0x00, 0x54, 0x87];
const CORAL = [0xf1, 0x58, 0x41];
const CLARO = [0xda, 0xe6, 0xee];

function mezclar(fondo, frente, alfa) {
  return [
    Math.round(fondo[0] * (1 - alfa) + frente[0] * alfa),
    Math.round(fondo[1] * (1 - alfa) + frente[1] * alfa),
    Math.round(fondo[2] * (1 - alfa) + frente[2] * alfa)
  ];
}

/** Distancia al segmento (para dibujar el galón con extremos redondeados). */
function distanciaSegmento(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const largo = dx * dx + dy * dy;
  let t = largo ? ((px - ax) * dx + (py - ay) * dy) / largo : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function pintarIcono(x, y, tam) {
  const u = tam / 512;
  const radio = 96 * u;

  // Rectángulo redondeado azul.
  const cx = Math.min(Math.max(x, radio), tam - radio);
  const cy = Math.min(Math.max(y, radio), tam - radio);
  if (Math.hypot(x - cx, y - cy) > radio) return [255, 255, 255];

  // Galón coral (dos trazos en «V» abierta hacia la derecha).
  const grosor = 46 * u;
  const d1 = distanciaSegmento(x, y, 150 * u, 140 * u, 256 * u, 256 * u);
  const d2 = distanciaSegmento(x, y, 256 * u, 256 * u, 150 * u, 372 * u);
  const d = Math.min(d1, d2);
  const alfa = Math.max(0, Math.min(1, (grosor / 2 - d) * u + 0.5));
  if (alfa > 0) return mezclar(AZUL, CORAL, alfa);

  // Rótulo «T4» en la parte inferior, trazado con segmentos.
  const t = 74 * u;
  const base = 452 * u;
  const grosorTexto = 15 * u;
  const xT = 196 * u;
  const anchoT = 50 * u;
  const x4 = 262 * u;
  const ancho4 = 54 * u;

  const trazos = [
    // «T»
    [xT, base - t, xT + anchoT, base - t],
    [xT + anchoT / 2, base - t, xT + anchoT / 2, base],
    // «4»
    [x4 + ancho4 * 0.76, base - t, x4, base - t * 0.32],
    [x4, base - t * 0.32, x4 + ancho4, base - t * 0.32],
    [x4 + ancho4 * 0.74, base - t, x4 + ancho4 * 0.74, base]
  ];

  let dTexto = Infinity;
  for (const trazo of trazos) {
    dTexto = Math.min(dTexto, distanciaSegmento(x, y, ...trazo));
  }
  const alfaTexto = Math.max(0, Math.min(1, (grosorTexto / 2 - dTexto) * u + 0.5));
  if (alfaTexto > 0) return mezclar(AZUL, CLARO, alfaTexto);

  return AZUL;
}

for (const tam of [180, 192, 512]) {
  const png = pngDesdePixels(tam, tam, (x, y) => pintarIcono(x, y, tam));
  const fichero = path.join(DESTINO, `icono-${tam}.png`);
  fs.writeFileSync(fichero, png);
  console.log(`✓ ${path.basename(fichero)} (${tam}×${tam}, ${png.length} bytes)`);
}
