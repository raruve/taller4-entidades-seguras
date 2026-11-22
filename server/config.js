/**
 * Configuración de la app del Taller 4.
 *
 * Todos los valores son personalizables por variables de entorno para poder
 * desplegar la app sin tocar el código. Ningún valor de este fichero contiene
 * datos personales ni información de participantes.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
export const PUBLIC_DIR = path.join(ROOT, 'public');

/** Fecha del taller (YYYY-MM-DD). Marca el inicio del plazo de conservación. */
export const WORKSHOP_DATE = process.env.WORKSHOP_DATE || '2026-11-22';

/** Días que se conservan los datos brutos tras el taller (art. 5.1.b RGPD). */
export const RETENTION_DAYS = Number(process.env.RETENTION_DAYS || 10);

/** Umbral de supresión en las exportaciones agregadas (células con n < MIN_N). */
export const MIN_N = Number(process.env.MIN_N || 3);

/** Publicación de la app. Si no se define, se deduce de la petición. */
export const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');

/** Clave del administrador del panel de dinamización. */
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

/** Datos del responsable del tratamiento que aparecen en la información legal. */
export const LEGAL = {
  responsable: process.env.RESPONSABLE || 'Pérez-Llorca',
  responsableCargo:
    process.env.RESPONSABLE_CARGO || 'Responsable del tratamiento de los datos del taller',
  contacto: process.env.CONTACTO || 'protecciondatos@perezllorca.com',
  entidadAlojamiento: process.env.ENTIDAD_ALOJAMIENTO || 'Proveedor de alojamiento de la app (encargado, art. 28 RGPD)',
  destinatarioExterno: process.env.DESTINATARIO_EXTERNO || 'Fundación Fresno',
  enlaceInfo: process.env.ENLACE_INFO || '',
  baseLegal:
    process.env.BASE_LEGAL ||
    'Participación voluntaria en el taller: consentimiento (art. 6.1.a RGPD). Los resultados agregados no son datos personales (Directrices 01/2025 del CEPD). Pendiente de confirmación por Pérez-Llorca.'
};

/** Datos del evento, para la cabecera y la pantalla de inicio. */
export const EVENTO = {
  red: 'RED SOLIDARIA SANTANDER',
  taller: 'TALLER 4',
  titulo: 'Entidades seguras en un mundo digital',
  subtitulo: 'Protección de datos, ciberseguridad e IA para patronatos y equipos de dirección',
  entidadDinamiza: 'Pérez-Llorca',
  secretaria: 'Fundación Fresno',
  fechaTexto: process.env.FECHA_TEXTO || 'Encuentro anual de la Red Solidaria Santander',
  lugarTexto: process.env.LUGAR_TEXTO || ''
};

/** Datos por defecto del panel: mesas abiertas. */
export const MESAS_INICIALES = [
  { alias: 'Mesa 1', caso: 1 },
  { alias: 'Mesa 2', caso: 2 },
  { alias: 'Mesa 3', caso: 3 },
  { alias: 'Mesa 4', caso: 4 }
];

/** Duración de la sesión de administración en el panel de dinamización. */
export const ADMIN_SESSION_MS = 8 * 60 * 60 * 1000;

export function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o750 });
}

/**
 * Contraseña del panel. Si no viene por entorno, se genera una aleatoria y se
 * guarda en un fichero con permisos restringidos, para no dejar una clave
 * débil por defecto en el código.
 */
export function resolveAdminPassword() {
  if (ADMIN_PASSWORD) return { password: ADMIN_PASSWORD, generated: false, path: null };
  ensureDataDir();
  const file = path.join(DATA_DIR, 'admin-password.txt');
  try {
    const stored = fs.readFileSync(file, 'utf8').trim();
    if (stored) return { password: stored, generated: true, path: file };
  } catch {
    /* se crea a continuación */
  }
  const password = crypto.randomBytes(9).toString('base64url');
  fs.writeFileSync(file, password, { mode: 0o600 });
  return { password, generated: true, path: file };
}
