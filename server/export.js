/**
 * Exportaciones para la pieza de conocimiento de la Red Solidaria.
 *
 * Reglas que aplica este módulo (documento de preparación, §6):
 *  · Solo datos agregados. Nunca seudónimos, nunca respuestas individuales.
 *  · Los textos libres NO se incluyen: se exportan aparte, ya depurados, en
 *    un fichero distinto y solo tras revisión explícita del dinamizador.
 *  · Las celdas con menos de MIN_N respuestas se suprimen («< n»), porque un
 *    recuento muy pequeño podría permitir reidentificar a quien respondió.
 */
import { MIN_N } from './config.js';
import { SEMAFORO, TERMOMETRO, CASOS } from './content.js';

function celda(valor) {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

function csvLinea(filas) {
  return filas.map(celda).join(',');
}

/** Aplica el umbral de supresión a un mapa de recuentos. */
function suprimir(recuentos) {
  const salida = {};
  for (const [clave, n] of Object.entries(recuentos || {})) {
    if (n >= MIN_N) salida[clave] = n;
    else salida[clave] = n > 0 ? `< ${MIN_N}` : 0;
  }
  return salida;
}

/**
 * Conjunto de datos agregados en formato largo (bloque, clave, respuestas).
 * Es el formato que se comparte: una fila por recuento.
 */
export function datosAgregados(resumen) {
  const filas = [];

  const termometro = Object.fromEntries(
    TERMOMETRO.map((q) => [q.id, q.pregunta])
  );
  for (const [clave, n] of Object.entries(resumen.termometro || {})) {
    filas.push({
      bloque: 'Termómetro · uso de IA',
      pregunta: termometro.ia,
      opcion: clave,
      respuestas: n,
      suprimido: n < MIN_N
    });
  }
  for (const [clave, n] of Object.entries(resumen.incidentes || {})) {
    filas.push({
      bloque: 'Termómetro · incidentes',
      pregunta: TERMOMETRO[1].pregunta,
      opcion: clave,
      respuestas: n,
      suprimido: n < MIN_N
    });
  }
  for (const [clave, n] of Object.entries(resumen.pautas || {})) {
    filas.push({
      bloque: 'Termómetro · pautas internas',
      pregunta: TERMOMETRO[2].pregunta,
      opcion: clave,
      respuestas: n,
      suprimido: n < MIN_N
    });
  }
  for (const medida of SEMAFORO) {
    const c = resumen.semaforo?.[medida.n] || { verde: 0, ambar: 0, rojo: 0 };
    for (const [estado, etiqueta] of [['verde', 'Lo tenemos'], ['ambar', 'A medias o sin documentar'], ['rojo', 'No lo tenemos']]) {
      const n = c[estado] || 0;
      filas.push({
        bloque: 'Semáforo · medidas',
        pregunta: `Medida ${medida.n}: ${medida.medida}`,
        opcion: etiqueta,
        respuestas: n,
        suprimido: n < MIN_N
      });
    }
  }
  for (const medida of SEMAFORO) {
    const n = resumen.prioridades?.[String(medida.n)] || 0;
    filas.push({
      bloque: 'Semáforo · prioridades elegidas',
      pregunta: `Medida ${medida.n}: ${medida.medida}`,
      opcion: 'Elegida como prioridad',
      respuestas: n,
      suprimido: n < MIN_N
    });
  }
  for (const caso of CASOS) {
    const n = resumen.casos?.[caso.id]?.respuestas || 0;
    filas.push({
      bloque: 'Casos · participación',
      pregunta: caso.titulo,
      opcion: 'Respuestas registradas',
      respuestas: n,
      suprimido: n < MIN_N
    });
  }
  // Áreas del sector y necesidades del grupo, con los votos que han
  // recibido. Solo entran las necesidades revisadas por la persona
  // dinamizadora; las áreas son propuestas de partida.
  for (const idea of resumen.ideas || []) {
    if (idea.origen === 'participante' && idea.estado !== 'aprobado') continue;
    const n = idea.votos || 0;
    filas.push({
      bloque: idea.origen === 'area' ? 'Áreas del sector · votación' : 'Necesidades del sector · votación',
      pregunta: idea.texto,
      opcion: idea.categoria || 'Necesidad del grupo',
      respuestas: n,
      suprimido: n < MIN_N
    });
  }
  return filas;
}

/** CSV largo con los datos agregados. */
export function csvAgregados(resumen) {
  const filas = datosAgregados(resumen);
  const lineas = [csvLinea(['bloque', 'pregunta', 'opcion', 'respuestas', 'suprimido'])];
  for (const f of filas) {
    lineas.push(csvLinea([f.bloque, f.pregunta, f.opcion, f.respuestas, f.suprimido ? 'sí' : 'no']));
  }
  return `﻿${lineas.join('\r\n')}\r\n`;
}

/** CSV con el detalle del semáforo (una fila por medida). */
export function csvSemaforo(resumen) {
  const lineas = [
    csvLinea(['medida', 'enunciado', 'verde_si', 'verde', 'ambar', 'rojo', 'elegida_como_prioridad'])
  ];
  for (const medida of SEMAFORO) {
    const c = resumen.semaforo?.[medida.n] || { verde: 0, ambar: 0, rojo: 0 };
    const p = resumen.prioridades?.[String(medida.n)] || 0;
    lineas.push(
      csvLinea([
        medida.n,
        medida.medida,
        medida.verdeSi,
        c.verde || 0,
        c.ambar || 0,
        c.rojo || 0,
        p || 0
      ])
    );
  }
  return `﻿${lineas.join('\r\n')}\r\n`;
}

/** CSV con los textos libres ya revisados y aprobados. */
export function csvTextosDepurados(textos) {
  const aprobados = textos.filter((t) => t.estado === 'aprobado');
  const lineas = [csvLinea(['bloque', 'caso', 'mesa', 'texto'])];
  for (const t of aprobados) {
    lineas.push(csvLinea([t.campo, t.caso || '', t.mesa || '', t.texto]));
  }
  return `﻿${lineas.join('\r\n')}\r\n`;
}

/** JSON estructurado, sin seudónimos ni textos originales. */
export function jsonAgregados(resumen, conservacion) {
  return {
    taller: 'Taller 4 · Entidades seguras en un mundo digital',
    red: 'Red Solidaria Santander',
    dinamizado_por: 'Pérez-Llorca',
    generado: new Date().toISOString(),
    aviso:
      'Documento con datos agregados. No contiene seudónimos, respuestas individuales ni textos originales de los participantes.',
    nota_confidencialidad: `Se suprimen los recuentos con menos de ${MIN_N} respuestas para evitar reidentificaciones.`,
    participantes: resumen.participantes,
    termometro: suprimir(resumen.termometro),
    incidentes: suprimir(resumen.incidentes),
    pautas: suprimir(resumen.pautas),
    semaforo: Object.fromEntries(
      SEMAFORO.map((m) => [
        m.n,
        {
          medida: m.medida,
          verdeSi: m.verdeSi,
          ...suprimir(resumen.semaforo?.[m.n] || {})
        }
      ])
    ),
    prioridades: suprimir(resumen.prioridades),
    retos: suprimir(resumen.retos || {}),
    casos: Object.fromEntries(
      CASOS.map((c) => {
        const n = resumen.casos?.[c.id]?.respuestas || 0;
        return [c.id, { titulo: c.titulo, respuestas: n > 0 && n < MIN_N ? `< ${MIN_N}` : n }];
      })
    ),
    ideas_fuerza: (resumen.ideas || [])
      .map((i) => ({ texto: i.texto, categoria: i.categoria, votos: i.votos || 0 }))
      .sort((a, b) => b.votos - a.votos),
    conservacion: conservacion || null
  };
}
