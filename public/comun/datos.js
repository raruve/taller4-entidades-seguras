/* ==================================================================
   Detección de datos personales — módulo compartido

   Lo usan el navegador (para avisar mientras se escribe) y el servidor
   (para impedir que se publique un texto con datos personales). Mismas
   reglas en los dos sitios: lo que el navegador enseña es lo que el
   servidor aplica.

   Es una comprobación heurística, no un filtro perfecto: sirve para
   evitar los despistes más habituales (un correo, un teléfono, un IBAN,
   un enlace). No sustituye al criterio de la persona dinamizadora.
   ================================================================== */

/**
 * Devuelve una lista de avisos (cadenas legibles) sobre el texto.
 * Una lista vacía significa que no se ha detectado nada.
 */
export function detectarDatosPersonales(texto) {
  const avisos = [];
  if (!texto) return avisos;
  if (/\b[\w.%+-]+@[\w.-]+\.[a-z]{2,}\b/i.test(texto)) avisos.push('parece un correo electrónico');
  if (/(?:\+34[\s-]?)?\b[6-9]\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/.test(texto)) avisos.push('parece un teléfono');
  if (/\b(?:\d{8}|\d{9}|IBAN|ES\d{2}[\s\d]{20})\b/i.test(texto)) avisos.push('parece un número de cuenta o IBAN');
  if (/https?:\/\//i.test(texto)) avisos.push('contiene un enlace web');
  if (/\b\d{1,3}\s+de\s+\d{4}\s+de\s+\d{4}\b/.test(texto)) avisos.push('parece una fecha completa');
  return avisos;
}

/** Texto para avisar al participante: por qué no se publica y qué hacer. */
export function mensajeDatosPersonales(avisos) {
  if (!avisos || !avisos.length) return '';
  const lista = avisos.join(', ');
  return `No se puede publicar porque el texto ${lista}. Escribe la necesidad sin datos personales: no pongas nombres, correos, teléfonos, cuentas ni enlaces.`;
}
