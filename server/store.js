/**
 * Almacén de respuestas.
 *
 * Principios de diseño (requisitos del documento de preparación, §6):
 *
 *  · Sin registro ni cuentas. Cada sesión se identifica con un código
 *    aleatorio que el navegador genera; el servidor guarda ÚNICAMENTE su
 *    hash SHA-256. Nunca se guarda una tabla de correspondencias entre el
 *    código y una persona, porque no existe tal vínculo en ningún momento.
 *  · No se guardan direcciones IP ni identificadores de dispositivo: el
 *    servidor no accede nunca a `req.socket.remoteAddress` ni registra las
 *    peticiones (no hay access log).
 *  · Se preferen respuestas cerradas. El texto libre se guarda separado y
 *    exige revisión antes de cualquier exportación.
 *  · Los datos brutos se borran a los 10 días del taller. Tras el borrado
 *    solo sobreviven los recuentos agregados, que no son datos personales.
 *
 * Ficheros:
 *   data/respuestas.json  → sesiones y moderación  (SE BORRA a los 10 días)
 *   data/config.json      → mesas, ideas, votación  (sin datos personales)
 *   data/agregados.json   → recuentos acumulados    (SE CONSERVA)
 *   data/auditoria.log    → registro de auditoría   (SE CONSERVA)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR, WORKSHOP_DATE, RETENTION_DAYS, ensureDataDir, MESAS_INICIALES } from './config.js';
import {
  CASOS,
  SEMAFORO,
  TERMOMETRO,
  CATEGORIAS_RETO,
  IDEAS_INICIALES,
  BLOQUES,
  OBJETIVOS,
  RESULTADOS_ESPERADOS,
  VERIFICACIONES
} from './content.js';

const FICHERO_RESPUESTAS = path.join(DATA_DIR, 'respuestas.json');
const FICHERO_CONFIG = path.join(DATA_DIR, 'config.json');
const FICHERO_AGREGADOS = path.join(DATA_DIR, 'agregados.json');
const FICHERO_AUDITORIA = path.join(DATA_DIR, 'auditoria.log');

const CODIGOS_TEXTO = 600; // caracteres máximos por respuesta libre
const MAX_PARTICIPANTES = 5000;

/* ------------------------------------------------------------------ *
 * Utilidades de disco
 * ------------------------------------------------------------------ */

function leerJson(fichero, porDefecto) {
  try {
    return JSON.parse(fs.readFileSync(fichero, 'utf8'));
  } catch {
    return porDefecto;
  }
}

/** Escritura atómica: fichero temporal + rename, para no dejar ficheros a medias. */
function escribirJson(fichero, datos) {
  ensureDataDir();
  const temporal = `${fichero}.tmp`;
  fs.writeFileSync(temporal, JSON.stringify(datos, null, 2), { mode: 0o640 });
  fs.renameSync(temporal, fichero);
}

function registrarAuditoria(evento, detalle = {}) {
  const linea = JSON.stringify({ fecha: new Date().toISOString(), evento, ...detalle });
  try {
    fs.appendFileSync(FICHERO_AUDITORIA, linea + '\n', { mode: 0o640 });
  } catch {
    /* el registro de auditoría no debe impedir el funcionamiento */
  }
}

/** Hash del código de sesión. El código en claro nunca se almacena. */
export function hashSesion(codigo) {
  return crypto.createHash('sha256').update(String(codigo), 'utf8').digest('hex').slice(0, 40);
}

/* ------------------------------------------------------------------ *
 * Carga / estado
 * ------------------------------------------------------------------ */

let respuestas = null;
let config = null;
let agregados = null;
let cola = Promise.resolve();

function cargar() {
  ensureDataDir();
  respuestas = leerJson(FICHERO_RESPUESTAS, { version: 1, sesiones: {}, moderacion: {} });
  if (!respuestas.sesiones) respuestas.sesiones = {};
  if (!respuestas.moderacion) respuestas.moderacion = {};

  config = leerJson(FICHERO_CONFIG, null) || {
    version: 1,
    mesas: MESAS_INICIALES.map((m) => ({ ...m, abierta: true })),
    ideas: [],
    votacionAbierta: false
  };

  agregados = leerJson(FICHERO_AGREGADOS, { version: 1, termometro: {}, incidentes: {}, pautas: {}, semaforo: {}, prioridades: {}, retos: {}, casos: {}, votos: {}, participantes: 0 });

  registrarAuditoria('ARRANQUE', { sesiones: Object.keys(respuestas.sesiones).length });
}

/** Ejecuta una operación serializando las escrituras. */
function enCola(fn) {
  const resultado = cola.then(fn, fn);
  cola = resultado.then(
    () => undefined,
    () => undefined
  );
  return resultado;
}

/* ------------------------------------------------------------------ *
 * Sesiones
 * ------------------------------------------------------------------ */

function obtenerSesion(id) {
  let sesion = respuestas.sesiones[id];
  if (!sesion) {
    if (Object.keys(respuestas.sesiones).length >= MAX_PARTICIPANTES) {
      throw Object.assign(new Error('Se ha alcanzado el límite de sesiones del taller.'), { status: 429 });
    }
    sesion = {
      creada: new Date().toISOString(),
      actualizada: new Date().toISOString()
    };
    respuestas.sesiones[id] = sesion;
  }
  return sesion;
}

function guardarRespuestas(id, seccion, datos) {
  return enCola(async () => {
    const sesion = obtenerSesion(id);
    sesion[seccion] = { ...datos, actualizado: new Date().toISOString() };
    sesion.actualizada = new Date().toISOString();
    escribirJson(FICHERO_RESPUESTAS, respuestas);
    actualizarAgregados(seccion, datos);
    escribirJson(FICHERO_AGREGADOS, agregados);
    return true;
  });
}

function estadoSesion(id) {
  const sesion = respuestas.sesiones[id];
  if (!sesion) return { vacia: true };
  return {
    vacia: false,
    termometro: sesion.termometro || null,
    mesa: sesion.mesa || null,
    semaforo: sesion.semaforo || null,
    retos: sesion.retos || null,
    creada: sesion.creada
  };
}

/* ------------------------------------------------------------------ *
 * Agregados (contadores sin datos personales)
 * ------------------------------------------------------------------ */

function incrementar(contenedor, clave, delta = 1) {
  if (!clave) return;
  contenedor[clave] = (contenedor[clave] || 0) + delta;
}

function actualizarAgregados(seccion, datos) {
  switch (seccion) {
    case 'termometro':
      if (datos.ia) incrementar(agregados.termometro, datos.ia);
      if (datos.pautas) incrementar(agregados.pautas, datos.pautas);
      if (Array.isArray(datos.incidentes)) {
        for (const op of datos.incidentes) incrementar(agregados.incidentes, op);
      }
      break;
    case 'semaforo':
      if (datos.medidas) {
        for (const [n, estado] of Object.entries(datos.medidas)) {
         incrementar(agregados.semaforo, `${n}|${estado}`);
        }
      }
      if (Array.isArray(datos.prioridades)) {
        for (const p of datos.prioridades) incrementar(agregados.prioridades, String(p));
      }
      break;
    case 'retos':
      if (Array.isArray(datos.categorias)) {
        for (const c of datos.categorias) incrementar(agregados.retos, c);
      }
      break;
    case 'mesa':
      if (datos.caso) incrementar(agregados.casos, String(datos.caso));
      break;
    case 'votacion':
      if (Array.isArray(datos.ideas)) {
        for (const idea of datos.ideas) incrementar(agregados.votos, idea);
      }
      break;
    default:
      break;
  }
}

/* ------------------------------------------------------------------ *
 * Moderación del texto libre
 * ------------------------------------------------------------------ */

const CLAVE_TEXTO = (id, campo) => `${id}#${campo}`;

function registrarTextos(id, seccion, datos) {
  for (const campo of ['riesgo', 'hacer', 'necesidad', 'reto']) {
    const texto = datos[campo];
    if (typeof texto === 'string' && texto.trim()) {
      const clave = CLAVE_TEXTO(id, campo);
      if (!respuestas.moderacion[clave]) {
        respuestas.moderacion[clave] = { estado: 'pendiente', actualizado: new Date().toISOString() };
      }
    }
  }
}

function moderar(clave, estado) {
  return enCola(async () => {
    if (!['pendiente', 'aprobado', 'rechazado'].includes(estado)) {
      throw Object.assign(new Error('Estado de moderación no válido.'), { status: 400 });
    }
    if (!respuestas.moderacion[clave]) {
      throw Object.assign(new Error('No existe ese texto.'), { status: 404 });
    }
    respuestas.moderacion[clave].estado = estado;
    respuestas.moderacion[clave].actualizado = new Date().toISOString();
    escribirJson(FICHERO_RESPUESTAS, respuestas);
    registrarAuditoria('MODERACION', { clave: `${clave.split('#')[0].slice(0, 8)}…#${clave.split('#')[1]}`, estado });
    return respuestas.moderacion[clave];
  });
}

/* ------------------------------------------------------------------ *
 * Mesas, ideas y votación (configuración del taller, sin datos personales)
 * ------------------------------------------------------------------ */

function guardarConfig() {
  escribirJson(FICHERO_CONFIG, config);
}

function listarMesas() {
  return config.mesas;
}

function crearMesa({ alias, caso }) {
  return enCola(async () => {
    const mesa = {
      alias: String(alias || '').trim().slice(0, 40),
      caso: Number(caso) || null,
      abierta: true
    };
    if (!mesa.alias) throw Object.assign(new Error('El alias de la mesa es obligatorio.'), { status: 400 });
    if (config.mesas.some((m) => m.alias.toLowerCase() === mesa.alias.toLowerCase())) {
      throw Object.assign(new Error('Ya existe una mesa con ese alias.'), { status: 409 });
    }
    config.mesas.push(mesa);
    guardarConfig();
    registrarAuditoria('MESA_CREADA', { alias: mesa.alias });
    return mesa;
  });
}

function actualizarMesa(alias, cambios) {
  return enCola(async () => {
    const mesa = config.mesas.find((m) => m.alias === alias);
    if (!mesa) throw Object.assign(new Error('No existe esa mesa.'), { status: 404 });
    if (cambios.caso !== undefined) mesa.caso = Number(cambios.caso) || null;
    if (cambios.abierta !== undefined) mesa.abierta = Boolean(cambios.abierta);
    guardarConfig();
    registrarAuditoria('MESA_ACTUALIZADA', { alias: mesa.alias });
    return mesa;
  });
}

function listarIdeas() {
  return config.ideas;
}

function anadirIdea({ texto, categoria }) {
  return enCola(async () => {
    const idea = {
      id: `i${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
      texto: String(texto || '').trim().slice(0, 180),
      categoria: String(categoria || '').trim().slice(0, 60),
      creada: new Date().toISOString()
    };
    if (!idea.texto) throw Object.assign(new Error('El texto de la idea no puede estar vacío.'), { status: 400 });
    config.ideas.push(idea);
    guardarConfig();
    registrarAuditoria('IDEA_CREADA', { id: idea.id });
    return idea;
  });
}

function borrarIdea(id) {
  return enCola(async () => {
    const antes = config.ideas.length;
    config.ideas = config.ideas.filter((i) => i.id !== id);
    if (config.ideas.length === antes) {
      throw Object.assign(new Error('No existe esa idea.'), { status: 404 });
    }
    guardarConfig();
    registrarAuditoria('IDEA_BORRADA', { id });
    return true;
  });
}

function abrirVotacion(abierta) {
  return enCola(async () => {
    config.votacionAbierta = Boolean(abierta);
    guardarConfig();
    registrarAuditoria('VOTACION', { abierta: config.votacionAbierta });
    return config.votacionAbierta;
  });
}

/* ------------------------------------------------------------------ *
 * Resumen agregado
 * ------------------------------------------------------------------ */

function resumen() {
  const sesiones = Object.values(respuestas.sesiones);
  const conRespuesta = sesiones.filter((s) => s.termometro || s.mesa || s.semaforo || s.retos);

  const porCaso = {};
  for (const caso of CASOS) {
    porCaso[caso.id] = { titulo: caso.titulo, respuestas: 0, mesas: {}, ultima: null };
  }

  const textos = [];
  for (const [id, sesion] of Object.entries(respuestas.sesiones)) {
    if (sesion.mesa && sesion.mesa.caso && porCaso[sesion.mesa.caso]) {
      const c = porCaso[sesion.mesa.caso];
      c.respuestas++;
      const alias = sesion.mesa.mesa || 'Sin mesa';
      c.mesas[alias] = c.mesas[alias] || { respuestas: 0, ultima: null };
      c.mesas[alias].respuestas++;
      c.mesas[alias].ultima = {
        riesgo: sesion.mesa.riesgo || '',
        hacer: sesion.mesa.hacer || '',
        necesidad: sesion.mesa.necesidad || '',
        actualizado: sesion.mesa.actualizado || null
      };
      c.ultima = c.mesas[alias].ultima;
    }
    if (sesion.retos && sesion.retos.reto && sesion.retos.reto.trim()) {
      textos.push({
        id: CLAVE_TEXTO(id, 'reto'),
        campo: 'reto',
        texto: sesion.retos.reto.trim(),
        estado: (respuestas.moderacion[CLAVE_TEXTO(id, 'reto')] || {}).estado || 'pendiente'
      });
    }
    for (const campo of ['riesgo', 'hacer', 'necesidad']) {
      const valor = sesion.mesa && sesion.mesa[campo];
      if (typeof valor === 'string' && valor.trim()) {
        textos.push({
          id: CLAVE_TEXTO(id, campo),
          campo,
          caso: sesion.mesa ? sesion.mesa.caso : null,
          mesa: sesion.mesa ? sesion.mesa.mesa || 'Sin mesa' : null,
          texto: valor.trim(),
          estado: (respuestas.moderacion[CLAVE_TEXTO(id, campo)] || {}).estado || 'pendiente'
        });
      }
    }
  }

  const semaforo = {};
  for (const m of SEMAFORO) semaforo[m.n] = { verde: 0, ambar: 0, rojo: 0 };
  for (const [clave, valor] of Object.entries(agregados.semaforo)) {
    const [n, estado] = clave.split('|');
    if (semaforo[n]) semaforo[n][estado] = valor;
  }

  const votosPorIdea = {};
  for (const idea of config.ideas) votosPorIdea[idea.id] = agregados.votos[idea.id] || 0;

  return {
    generado: new Date().toISOString(),
    participantes: conRespuesta.length,
    sesionesRegistradas: sesiones.length,
    termometro: { ...agregados.termometro },
    incidentes: { ...agregados.incidentes },
    pautas: { ...agregados.pautas },
    semaforo,
    medidasTexto: Object.fromEntries(SEMAFORO.map((m) => [String(m.n), m.medida])),
    prioridades: { ...agregados.prioridades },
    retos: { ...agregados.retos },
    casos: porCaso,
    // Guía de resolución de los casos: solo para el equipo dinamizador.
    guia: CASOS.map((c) => ({
      id: c.id,
      titulo: c.titulo,
      escenario: c.escenario,
      mensaje: c.mensaje,
      resolucion: c.resolucion
    })),
    votos: votosPorIdea,
    ideas: config.ideas.map((i) => ({ ...i, votos: votosPorIdea[i.id] || 0 })),
    // Sugerencias para preparar la votación en directo: no se muestran a los
    // participantes hasta que la persona dinamizadora las añade.
    ideasSugeridas: IDEAS_INICIALES,
    // Material de apoyo a la persona dinamizadora.
    bloques: BLOQUES,
    objetivos: OBJETIVOS,
    resultadosEsperados: RESULTADOS_ESPERADOS,
    verificaciones: VERIFICACIONES,
    mesas: config.mesas,
    votacionAbierta: config.votacionAbierta,
    textosPendientes: textos.filter((t) => t.estado === 'pendiente').length,
    textos: textos.sort((a, b) => a.campo.localeCompare(b.campo)),
    conservacion: {
      fechaTaller: WORKSHOP_DATE,
      dias: RETENTION_DAYS,
      fechaBorrado: fechaBorrado(),
      diasRestantes: diasRestantes()
    }
  };
}

/* ------------------------------------------------------------------ *
 * Conservación y borrado
 * ------------------------------------------------------------------ */

function fechaBorrado() {
  const base = new Date(`${WORKSHOP_DATE}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return null;
  base.setUTCDate(base.getUTCDate() + RETENTION_DAYS);
  return base.toISOString().slice(0, 10);
}

function diasRestantes() {
  const base = new Date(`${WORKSHOP_DATE}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return null;
  const fin = new Date(base);
  fin.setUTCDate(fin.getUTCDate() + RETENTION_DAYS);
  const hoy = new Date();
  return Math.ceil((fin.getTime() - hoy.getTime()) / 86400000);
}

/**
 * Borra los datos brutos. Es la única función que elimina respuestas, y deja
 * constancia en el registro de auditoría.
 */
export function purgar(motivo = 'manual') {
  return enCola(async () => {
    const sesiones = Object.keys(respuestas.sesiones).length;
    const textos = Object.keys(respuestas.moderacion).length;

    // 1. Se sustituye el contenido por el de una sesión nueva: las respuestas
    //    y sus textos moderados desaparecen.
    respuestas = { version: 1, sesiones: {}, moderacion: {} };
    escribirJson(FICHERO_RESPUESTAS, respuestas);

    // 2. No hay tabla de correspondencias que borrar: nunca se ha creado
    //    (solo se almacena el hash del código de sesión).

    // 3. Se conservan únicamente los recuentos agregados.
    escribirJson(FICHERO_AGREGADOS, agregados);

    registrarAuditoria('PURGA', {
      motivo,
      sesionesBorradas: sesiones,
      textosBorrados: textos,
      tablaCorrespondencias: 'no existía (solo se conservaba el hash del código de sesión)',
      conservados: 'recuentos agregados'
    });
    return { sesionesBorradas: sesiones, textosBorrados: textos, motivo };
  });
}

/** Ejecuta el borrado programado si ya ha vencido el plazo de conservación. */
export function purgaProgramada() {
  const restante = diasRestantes();
  if (restante === null) return null;
  if (restante > 0) return null;
  return purgar('programada');
}

function auditoria(limite = 200) {
  try {
    const contenido = fs.readFileSync(FICHERO_AUDITORIA, 'utf8').trim();
    if (!contenido) return [];
    const lineas = contenido.split('\n').slice(-limite);
    return lineas
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return { fecha: null, evento: l };
        }
      })
      .reverse();
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ *
 * Validación de entradas
 * ------------------------------------------------------------------ */

function limpiarTexto(valor, max = CODIGOS_TEXTO) {
  if (typeof valor !== 'string') return '';
  return valor.replace(/\u0000/g, '').trim().slice(0, max);
}

function validarTermometro(datos) {
  const salida = {};
  const q = Object.fromEntries(TERMOMETRO.map((t) => [t.id, t]));
  if (q.ia && q.ia.opciones.includes(datos.ia)) salida.ia = datos.ia;
  if (q.pautas && q.pautas.opciones.includes(datos.pautas)) salida.pautas = datos.pautas;
  if (Array.isArray(datos.incidentes)) {
    salida.incidentes = datos.incidentes.filter((o) => q.incidentes.opciones.includes(o));
  }
  if (!salida.ia && !salida.pautas && !salida.incidentes) {
    throw Object.assign(new Error('No hay respuestas válidas.'), { status: 400 });
  }
  return salida;
}

function validarSemaforo(datos) {
  const medidas = {};
  if (datos.medidas && typeof datos.medidas === 'object') {
    for (const [n, estado] of Object.entries(datos.medidas)) {
      const numero = Number(n);
      if (!SEMAFORO.some((m) => m.n === numero)) continue;
      if (!['verde', 'ambar', 'rojo'].includes(estado)) continue;
      medidas[String(numero)] = estado;
    }
  }
  const prioridades = Array.isArray(datos.prioridades)
    ? [...new Set(datos.prioridades.map(Number).filter((n) => SEMAFORO.some((m) => m.n === n)))].slice(0, 3)
    : [];
  return { medidas, prioridades };
}

function validarRetos(datos) {
  const categorias = Array.isArray(datos.categorias)
    ? [...new Set(datos.categorias.filter((c) => CATEGORIAS_RETO.includes(c)))]
    : [];
  return { categorias, reto: limpiarTexto(datos.reto) };
}

function validarMesa(datos) {
  const caso = CASOS.find((c) => c.id === Number(datos.caso));
  if (!caso) throw Object.assign(new Error('Caso no válido.'), { status: 400 });
  const alias = String(datos.mesa || '').trim().slice(0, 40);
  return {
    caso: caso.id,
    mesa: alias,
    modo: datos.modo === 'individual' ? 'individual' : 'mesa',
    riesgo: limpiarTexto(datos.riesgo),
    hacer: limpiarTexto(datos.hacer),
    necesidad: limpiarTexto(datos.necesidad)
  };
}

function validarVotacion(datos) {
  const ids = config.ideas.map((i) => i.id);
  const ideas = Array.isArray(datos.ideas)
    ? [...new Set(datos.ideas.filter((i) => ids.includes(i)))].slice(0, 2)
    : [];
  return { ideas };
}

/* ------------------------------------------------------------------ *
 * API pública del almacén
 * ------------------------------------------------------------------ */

export const store = {
  init() {
    cargar();
  },
  get estado() {
    return {
      respuestas,
      config,
      agregados
    };
  },
  hash: hashSesion,
  estadoSesion,
  guardarTermometro(id, datos) {
    const limpio = validarTermometro(datos);
    return enCola(async () => {
      const sesion = obtenerSesion(id);
      sesion.termometro = { ...limpio, actualizado: new Date().toISOString() };
      sesion.actualizada = new Date().toISOString();
      escribirJson(FICHERO_RESPUESTAS, respuestas);
      actualizarAgregados('termometro', limpio);
      escribirJson(FICHERO_AGREGADOS, agregados);
      return sesion.termometro;
    });
  },
  guardarMesa(id, datos) {
    const limpio = validarMesa(datos);
    return enCola(async () => {
      const sesion = obtenerSesion(id);
      sesion.mesa = { ...limpio, actualizado: new Date().toISOString() };
      sesion.actualizada = new Date().toISOString();
      registrarTextos(id, 'mesa', limpio);
      escribirJson(FICHERO_RESPUESTAS, respuestas);
      actualizarAgregados('mesa', limpio);
      escribirJson(FICHERO_AGREGADOS, agregados);
      return sesion.mesa;
    });
  },
  guardarSemaforo(id, datos) {
    const limpio = validarSemaforo(datos);
    return enCola(async () => {
      const sesion = obtenerSesion(id);
      sesion.semaforo = { ...limpio, actualizado: new Date().toISOString() };
      sesion.actualizada = new Date().toISOString();
      escribirJson(FICHERO_RESPUESTAS, respuestas);
      actualizarAgregados('semaforo', limpio);
      escribirJson(FICHERO_AGREGADOS, agregados);
      return sesion.semaforo;
    });
  },
  guardarRetos(id, datos) {
    const limpio = validarRetos(datos);
    return enCola(async () => {
      const sesion = obtenerSesion(id);
      sesion.retos = { ...limpio, actualizado: new Date().toISOString() };
      sesion.actualizada = new Date().toISOString();
      registrarTextos(id, 'retos', limpio);
      escribirJson(FICHERO_RESPUESTAS, respuestas);
      actualizarAgregados('retos', limpio);
      escribirJson(FICHERO_AGREGADOS, agregados);
      return sesion.retos;
    });
  },
  guardarVotacion(id, datos) {
    const limpio = validarVotacion(datos);
    return enCola(async () => {
      const sesion = obtenerSesion(id);
      sesion.votacion = { ...limpio, actualizado: new Date().toISOString() };
      sesion.actualizada = new Date().toISOString();
      escribirJson(FICHERO_RESPUESTAS, respuestas);
      actualizarAgregados('votacion', limpio);
      escribirJson(FICHERO_AGREGADOS, agregados);
      return sesion.votacion;
    });
  },
  resumen,
  moderar,
  listarMesas,
  crearMesa,
  actualizarMesa,
  listarIdeas,
  anadirIdea,
  borrarIdea,
  abrirVotacion,
  purgar,
  purgaProgramada,
  auditoria,
  fechaBorrado,
  diasRestantes
};

export { CODIGOS_TEXTO };
