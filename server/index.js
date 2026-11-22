/**
 * Servidor de la app del Taller 4.
 *
 * Node puro, sin dependencias: la app no instala ni carga nada de terceros,
 * no hace peticiones salientes y no registra direcciones IP. Todo el tráfico
 * es «same-origin» y los recursos (tipografías, scripts, estilos) son locales.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  PUBLIC_DIR,
  DATA_DIR,
  EVENTO,
  LEGAL,
  WORKSHOP_DATE,
  RETENTION_DAYS,
  MIN_N,
  PUBLIC_URL,
  ADMIN_SESSION_MS,
  resolveAdminPassword,
  ensureDataDir
} from './config.js';
import {
  AGENDA,
  TERMOMETRO,
  CASOS,
  SEMAFORO,
  ESTADOS_SEMAFORO,
  CATEGORIAS_RETO,
  IDEAS_INICIALES,
  MENSAJES_CIERRE,
  AVISO_TEXTO_LIBRE_UI,
  INFO_LEGAL_CORTA,
  infoLegalLarga
} from './content.js';
import { store } from './store.js';
import { encodeQR, qrToSvg, qrToPng } from './qr.js';
import { csvAgregados, csvSemaforo, csvTextosDepurados, jsonAgregados } from './export.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

const { password: ADMIN_PASSWORD, generated: passwordGenerada, path: passwordPath } = resolveAdminPassword();

ensureDataDir();
store.init();

/* ------------------------------------------------------------------ *
 * Utilidades HTTP
 * ------------------------------------------------------------------ */

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function cabecerasSeguridad(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), interest-cohort=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      // Los scripts son estrictos (ningún script en línea). Los estilos en
      // línea se permiten porque el panel de dinamización ajusta con ellos el
      // ancho de las barras de resultados; no permiten ejecutar código.
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "form-action 'none'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "object-src 'none'"
    ].join('; ')
  );
}

function responderJson(res, datos, codigo = 200) {
  const cuerpo = JSON.stringify(datos);
  res.writeHead(codigo, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(cuerpo),
    'Cache-Control': 'no-store'
  });
  res.end(cuerpo);
}

function responderError(res, codigo, mensaje) {
  responderJson(res, { error: mensaje }, codigo);
}

function responderTexto(res, cuerpo, tipo, nombre) {
  const buffer = Buffer.from(cuerpo, 'utf8');
  const cabeceras = {
    'Content-Type': tipo,
    'Content-Length': buffer.length,
    'Cache-Control': 'no-store'
  };
  if (nombre) {
    cabeceras['Content-Disposition'] = `attachment; filename="${nombre}"`;
  }
  res.writeHead(200, cabeceras);
  res.end(buffer);
}

async function leerCuerpo(req, limite = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let datos = '';
    let recibido = 0;
    req.on('data', (trozo) => {
      recibido += trozo.length;
      if (recibido > limite) {
        reject(Object.assign(new Error('Cuerpo demasiado grande.'), { status: 413 }));
        req.destroy();
        return;
      }
      datos += trozo;
    });
    req.on('end', () => {
      if (!datos) return resolve({});
      try {
        resolve(JSON.parse(datos));
      } catch {
        reject(Object.assign(new Error('JSON no válido.'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

/* ------------------------------------------------------------------ *
 * Autenticación del panel (sin cookies: token en memoria + cabecera)
 * ------------------------------------------------------------------ */

const sesionesAdmin = new Map();

function crearTokenAdmin() {
  const token = crypto.randomBytes(24).toString('base64url');
  sesionesAdmin.set(token, Date.now() + ADMIN_SESSION_MS);
  return token;
}

function tokenValido(token) {
  if (!token) return false;
  const caducidad = sesionesAdmin.get(token);
  if (!caducidad) return false;
  if (Date.now() > caducidad) {
    sesionesAdmin.delete(token);
    return false;
  }
  return true;
}

function comprobarAdmin(req) {
  const cabecera = req.headers['x-admin-token'];
  if (typeof cabecera === 'string' && tokenValido(cabecera)) return true;
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return tokenValido(auth.slice(7));
  }
  return false;
}

/* ------------------------------------------------------------------ *
 * Configuración pública
 * ------------------------------------------------------------------ */

/**
 * Convierte el código de sesión que envía el navegador en su identificador
 * interno (hash SHA-256). El código en claro no se almacena nunca.
 */
function idDeSesion(url) {
  const codigo = url.searchParams.get('codigo');
  if (!codigo || !/^[A-Za-z0-9-]{4,32}$/.test(codigo)) return null;
  return store.hash(codigo);
}

function configuracionPublica(req) {
  const origen = PUBLIC_URL || `http://${req.headers.host || 'localhost:' + PORT}`;
  return {    evento: EVENTO,
    urlPublica: origen,
    agenda: AGENDA,
    termometro: TERMOMETRO,
    casos: CASOS.map((c) => ({
      id: c.id,
      titulo: c.titulo,
      escenario: c.escenario,
      preguntas: c.preguntas,
      mensaje: c.mensaje
    })),
    semaforo: SEMAFORO,
    estadosSemaforo: ESTADOS_SEMAFORO,
    categoriasReto: CATEGORIAS_RETO,
    ideasIniciales: IDEAS_INICIALES,
    mensajesCierre: MENSAJES_CIERRE,
    aviso: AVISO_TEXTO_LIBRE_UI,
    infoLegalCorta: INFO_LEGAL_CORTA,
    infoLegalLarga: infoLegalLarga(LEGAL, EVENTO, RETENTION_DAYS, LEGAL.enlaceInfo),
    conservacion: { fechaTaller: WORKSHOP_DATE, dias: RETENTION_DAYS },
    minN: MIN_N
  };
}

/* ------------------------------------------------------------------ *
 * Rutas
 * ------------------------------------------------------------------ */

const servidor = http.createServer(async (req, res) => {
  cabecerasSeguridad(res);

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const ruta = url.pathname.replace(/\/+$/, '') || '/';

  try {
    if (ruta.startsWith('/api/')) {
      await api(req, res, ruta, url);
      return;
    }
    await estaticos(req, res, ruta);
  } catch (error) {
    const codigo = error.status || 500;
    if (codigo >= 500) {
      // No se registra la IP ni la URL: solo el tipo de error.
      console.error(`[error] ${error && error.message}`);
    }
    if (res.headersSent) {
      // Si ya se habían escrito las cabeceras, no se puede enviar una
      // respuesta de error: se cierra la conexión para no dejar al cliente
      // esperando indefinidamente.
      res.destroy();
      return;
    }
    responderError(res, codigo, error.message || 'Error inesperado');
  }
});

async function api(req, res, ruta, url) {
  const metodo = req.method.toUpperCase();

  /* --- configuración y estado público --- */

  if (ruta === '/api/config' && metodo === 'GET') {
    responderJson(res, configuracionPublica(req));
    return;
  }

  if (ruta === '/api/estado' && metodo === 'GET') {
    const id = idDeSesion(url);
    if (!id) {
      responderError(res, 400, 'Sesión no válida.');
      return;
    }
    responderJson(res, store.estadoSesion(id));
    return;
  }

  if (ruta === '/api/mesas' && metodo === 'GET') {
    responderJson(res, { mesas: store.listarMesas().filter((m) => m.abierta !== false) });
    return;
  }

  if (ruta === '/api/ideas' && metodo === 'GET') {
    const ideas = store.listarIdeas();
    const votacionAbierta = store.estado.config.votacionAbierta;
    responderJson(res, {
      votacionAbierta,
      ideas: ideas.map((i) => ({ id: i.id, texto: i.texto, categoria: i.categoria })),
      resultados: votacionAbierta ? null : ideas.map((i) => ({ id: i.id, votos: store.estado.agregados.votos[i.id] || 0 }))
    });
    return;
  }

  /* --- código QR de acceso (público: solo codifica la dirección de la app) --- */

  if ((ruta === '/api/qr.svg' || ruta === '/api/qr.png') && metodo === 'GET') {
    const destino = PUBLIC_URL || `http://${req.headers.host || 'localhost:' + PORT}/`;
    const qr = encodeQR(destino, { ecc: 'M' });
    if (ruta.endsWith('.svg')) {
      const svg = qrToSvg(qr, { scale: 10, margin: 4 });
      res.writeHead(200, {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(svg),
        'Cache-Control': 'no-store'
      });
      res.end(svg);
    } else {
      const png = qrToPng(qr, { scale: 10, margin: 4 });
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': png.length, 'Cache-Control': 'no-store' });
      res.end(png);
    }
    return;
  }

  /* --- respuestas de los participantes --- */

  if (ruta.startsWith('/api/respuestas/')) {
    if (metodo !== 'POST') {
      responderError(res, 405, 'Método no permitido.');
      return;
    }
    const id = idDeSesion(url);
    if (!id) {
      responderError(res, 400, 'Sesión no válida.');
      return;
    }
    const cuerpo = await leerCuerpo(req);
    const seccion = ruta.slice('/api/respuestas/'.length);
    let resultado;
    if (seccion === 'termometro') resultado = await store.guardarTermometro(id, cuerpo);
    else if (seccion === 'mesa') resultado = await store.guardarMesa(id, cuerpo);
    else if (seccion === 'semaforo') resultado = await store.guardarSemaforo(id, cuerpo);
    else if (seccion === 'retos') resultado = await store.guardarRetos(id, cuerpo);
    else if (seccion === 'votacion') resultado = await store.guardarVotacion(id, cuerpo);
    else {
      responderError(res, 404, 'Sección desconocida.');
      return;
    }
    responderJson(res, { ok: true, ...resultado });
    return;
  }

  /* --- panel de dinamización --- */

  if (ruta === '/api/admin/login' && metodo === 'POST') {
    const cuerpo = await leerCuerpo(req);
    const recibido = String(cuerpo.password || '');
    const a = crypto.createHash('sha256').update(recibido).digest();
    const b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
    if (!crypto.timingSafeEqual(a, b)) {
      responderError(res, 401, 'Contraseña incorrecta.');
      return;
    }
    responderJson(res, { token: crearTokenAdmin(), expira: Date.now() + ADMIN_SESSION_MS });
    return;
  }

  if (ruta.startsWith('/api/admin/')) {
    if (!comprobarAdmin(req)) {
      responderError(res, 401, 'Sesión de administración no válida.');
      return;
    }
    await admin(req, res, ruta, url);
    return;
  }

  responderError(res, 404, 'Ruta no encontrada.');
}

async function admin(req, res, ruta, url) {
  const metodo = req.method.toUpperCase();
  const sub = ruta.slice('/api/admin/'.length);

  if (sub === 'resumen' && metodo === 'GET') {
    responderJson(res, store.resumen());
    return;
  }

  if (sub === 'mesas') {
    if (metodo === 'GET') {
      responderJson(res, { mesas: store.listarMesas() });
      return;
    }
    if (metodo === 'POST') {
      const cuerpo = await leerCuerpo(req);
      responderJson(res, { mesa: await store.crearMesa(cuerpo) });
      return;
    }
  }

  if (sub.startsWith('mesas/') && metodo === 'PATCH') {
    const alias = decodeURIComponent(sub.slice('mesas/'.length));
    const cuerpo = await leerCuerpo(req);
    responderJson(res, { mesa: await store.actualizarMesa(alias, cuerpo) });
    return;
  }

  if (sub === 'ideas') {
    if (metodo === 'GET') {
      responderJson(res, { ideas: store.listarIdeas() });
      return;
    }
    if (metodo === 'POST') {
      const cuerpo = await leerCuerpo(req);
      responderJson(res, { idea: await store.anadirIdea(cuerpo) });
      return;
    }
  }

  if (sub.startsWith('ideas/') && metodo === 'DELETE') {
    const id = sub.slice('ideas/'.length);
    await store.borrarIdea(id);
    responderJson(res, { ok: true });
    return;
  }

  if (sub === 'votacion' && metodo === 'POST') {
    const cuerpo = await leerCuerpo(req);
    const abierta = await store.abrirVotacion(cuerpo.abierta);
    responderJson(res, { votacionAbierta: abierta });
    return;
  }

  if (sub.startsWith('textos/') && metodo === 'POST') {
    const clave = decodeURIComponent(sub.slice('textos/'.length));
    const cuerpo = await leerCuerpo(req);
    const estado = await store.moderar(clave, cuerpo.estado);
    responderJson(res, { moderacion: estado });
    return;
  }

  if (sub === 'purgar' && metodo === 'POST') {
    const resultado = await store.purgar('manual');
    responderJson(res, { ok: true, ...resultado });
    return;
  }

  if (sub === 'auditoria' && metodo === 'GET') {
    responderJson(res, { entradas: store.auditoria() });
    return;
  }

  // Copia de seguridad completa de la sesión. Necesaria cuando el servicio
  // se aloja sin disco persistente (plan gratuito): al dormirse, el sistema
  // de ficheros se borra y con él las respuestas y los agregados.
  if (sub === 'copia' && metodo === 'GET') {
    const copia = store.exportarCopia();
    responderTexto(
      res,
      JSON.stringify(copia, null, 2),
      'application/json; charset=utf-8',
      'taller4-copia-de-seguridad.json'
    );
    return;
  }

  if (sub === 'copia' && metodo === 'POST') {
    let copia;
    try {
      // Una copia completa puede pesar bastante más que una respuesta normal.
      copia = await leerCuerpo(req, 16 * 1024 * 1024);
    } catch (error) {
      responderJson(res, { error: error.message }, error.status || 400);
      return;
    }
    try {
      const resultado = await store.restaurarCopia(copia);
      responderJson(res, { ok: true, ...resultado });
    } catch (error) {
      responderJson(res, { error: error.message }, 400);
    }
    return;
  }

  if (sub === 'exportar/fresno.csv' && metodo === 'GET') {
    const resumen = store.resumen();
    responderTexto(res, csvAgregados(resumen), 'text/csv; charset=utf-8', 'taller4-resultados-agregados.csv');
    return;
  }

  if (sub === 'exportar/fresno.json' && metodo === 'GET') {
    const resumen = store.resumen();
    responderTexto(
      res,
      JSON.stringify(jsonAgregados(resumen, resumen.conservacion), null, 2),
      'application/json; charset=utf-8',
      'taller4-resultados-agregados.json'
    );
    return;
  }

  if (sub === 'exportar/semaforo.csv' && metodo === 'GET') {
    responderTexto(res, csvSemaforo(store.resumen()), 'text/csv; charset=utf-8', 'taller4-semaforo.csv');
    return;
  }

  if (sub === 'exportar/textos-depurados.csv' && metodo === 'GET') {
    const resumen = store.resumen();
    responderTexto(
      res,
      csvTextosDepurados(resumen.textos),
      'text/csv; charset=utf-8',
      'taller4-textos-depurados.csv'
    );
    return;
  }

  if (sub === 'qr.svg' && metodo === 'GET') {
    const destino = url.searchParams.get('url') || PUBLIC_URL || `http://${req.headers.host}/`;
    const qr = encodeQR(destino, { ecc: 'M' });
    res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(qrToSvg(qr, { scale: 10, margin: 4 }));
    return;
  }

  if (sub === 'qr.png' && metodo === 'GET') {
    const destino = url.searchParams.get('url') || PUBLIC_URL || `http://${req.headers.host}/`;
    const qr = encodeQR(destino, { ecc: 'M' });
    const png = qrToPng(qr, { scale: 10, margin: 4 });
    res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': png.length, 'Cache-Control': 'no-store' });
    res.end(png);
    return;
  }

  responderError(res, 404, 'Ruta de administración no encontrada.');
}

/* ------------------------------------------------------------------ *
 * Ficheros estáticos
 * ------------------------------------------------------------------ */

async function estaticos(req, res, ruta) {
  const metodo = req.method.toUpperCase();
  if (metodo !== 'GET' && metodo !== 'HEAD') {
    responderError(res, 405, 'Método no permitido.');
    return;
  }

  let relativo;
  if (ruta === '/' || ruta === '/app') relativo = 'index.html';
  else if (ruta === '/admin') relativo = 'admin.html';
  else if (ruta === '/imprimir') relativo = 'imprimir.html';
  else if (ruta === '/cartela') relativo = 'cartela.html';
  else if (ruta === '/legal') relativo = 'legal.html';
  else relativo = ruta.replace(/^\/+/, '');

  const destino = path.resolve(PUBLIC_DIR, relativo);
  if (!destino.startsWith(path.resolve(PUBLIC_DIR))) {
    responderError(res, 403, 'Acceso no permitido.');
    return;
  }

  fs.stat(destino, (error, stats) => {
    if (error || !stats.isFile()) {
      responderError(res, 404, 'Página no encontrada.');
      return;
    }
    const tipo = TIPOS[path.extname(destino).toLowerCase()] || 'application/octet-stream';
    const cache = ruta.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache';
    res.writeHead(200, {
      'Content-Type': tipo,
      'Content-Length': stats.size,
      'Cache-Control': cache
    });
    if (metodo === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(destino).pipe(res);
  });
}

/* ------------------------------------------------------------------ *
 * Arranque
 * ------------------------------------------------------------------ */

const purga = store.purgaProgramada();
if (purga) {
  console.log('· Se ha aplicado el borrado programado de los datos brutos.');
}

const temporizadorPurga = setInterval(() => {
  store.purgaProgramada();
}, 15 * 60 * 1000);
temporizadorPurga.unref?.();

/* ------------------------------------------------------------------ *
 * Cierre ordenado
 *
 * `docker compose restart` o `docker compose down` envían SIGTERM. Sin este
 * manejo, Node terminaría de inmediato y podría cortar una respuesta a medias
 * (por ejemplo, la respuesta de una persona participante). Con él, el
 * servidor deja de aceptar conexiones, deja terminar las que están en curso y
 * sale limpiamente.
 * ------------------------------------------------------------------ */

let cerrando = false;

function cerrar(senal) {
  if (cerrando) return;
  cerrando = true;
  console.log(`\n[${senal}] Cerrando el servidor…`);
  clearInterval(temporizadorPurga);
  const salida = () => process.exit(0);
  servidor.close(() => salida());
  // Si alguna conexión se queda colgada, se fuerza la salida en 10 s.
  setTimeout(salida, 10000).unref();
}

process.on('SIGTERM', () => cerrar('SIGTERM'));
process.on('SIGINT', () => cerrar('SIGINT'));

servidor.listen(PORT, HOST, () => {
  const base = PUBLIC_URL || `http://localhost:${PORT}`;
  console.log('');
  console.log('  Taller 4 · Entidades seguras en un mundo digital');
  console.log('  ------------------------------------------------');
  console.log(`  App para participantes : ${base}/`);
  console.log(`  Panel de dinamización : ${base}/admin`);
  console.log(`  QR de acceso          : ${base}/admin/qr.svg`);
  console.log('');
  console.log(`  Fecha del taller      : ${WORKSHOP_DATE}`);
  console.log(`  Borrado de datos brutos: ${store.fechaBorrado()} (${RETENTION_DAYS} días)`);
  console.log('');
  if (passwordGenerada) {
    console.log(`  Contraseña del panel  : ${ADMIN_PASSWORD}`);
    console.log(`  (fichero: ${passwordPath})`);
    console.log('  Defina ADMIN_PASSWORD por variable de entorno para fijarla.');
  } else {
    console.log('  Contraseña del panel  : definida por ADMIN_PASSWORD');
  }
  console.log('');
});
