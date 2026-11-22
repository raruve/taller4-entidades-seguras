/* ==================================================================
   Panel de dinamización · Taller 4
   Red Solidaria Santander · Pérez-Llorca
   ================================================================== */

const estado = {
  token: sessionStorage.getItem('t4_admin') || null,
  resumen: null,
  pestana: 'resultados',
  ideasSeleccionadas: new Set(),
  votacionAbierta: false,
  // Último identificador de arranque del servicio visto en esta sesión del
  // navegador. Si cambia, el servicio se ha reiniciado y, sin disco
  // persistente, los datos de la sesión anterior se han perdido.
  arranqueVisto: sessionStorage.getItem('t4_arranque') || null,
  refrescoAuto: sessionStorage.getItem('t4_refresco') !== 'no'
};

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

function escapar(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

async function api(ruta, opciones = {}) {
  const respuesta = await fetch(ruta, {
    method: opciones.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(estado.token ? { 'X-Admin-Token': estado.token } : {})
    },
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
    credentials: 'omit',
    cache: 'no-store'
  });
  const texto = await respuesta.text();
  let datos = {};
  try {
    datos = texto ? JSON.parse(texto) : {};
  } catch {
    datos = {};
  }
  if (!respuesta.ok) {
    if (respuesta.status === 401) {
      estado.token = null;
      sessionStorage.removeItem('t4_admin');
      renderLogin('La sesión ha caducado. Vuelve a entrar.');
    }
    throw Object.assign(new Error(datos.error || 'Error'), { status: respuesta.status });
  }
  return datos;
}

/* ------------------------------------------------------------------
   Acceso
   ------------------------------------------------------------------ */

function renderLogin(mensaje) {
  $('#admin').innerHTML = `
    <div class="tarjeta" style="max-width:26rem;margin:3rem auto">
      <div class="kicker">Acceso restringido</div>
      <h2>Panel de dinamización</h2>
      <p class="nota">Acceso para el equipo dinamizador. Las respuestas se muestran agregadas y el texto libre requiere revisión antes de exportarlo.</p>
      <form id="form-login">
        <div class="campo-bloque">
          <label class="campo" for="password">Contraseña</label>
          <input type="password" id="password" autocomplete="current-password" />
        </div>
        <button type="submit" class="boton boton-primario">Entrar</button>
        <div id="aviso-login">${mensaje ? `<div class="mensaje mensaje-error">${escapar(mensaje)}</div>` : ''}</div>
      </form>
    </div>`;
  $('#form-login').addEventListener('submit', entrar);
}

async function entrar(evento) {
  evento.preventDefault();
  const password = $('#password').value;
  try {
    const datos = await api('/api/admin/login', { method: 'POST', body: { password } });
    estado.token = datos.token;
    sessionStorage.setItem('t4_admin', datos.token);
    await cargar();
  } catch (error) {
    $('#aviso-login').innerHTML = `<div class="mensaje mensaje-error">${escapar(error.message)}</div>`;
  }
}

/* ------------------------------------------------------------------
   Carga de datos
   ------------------------------------------------------------------ */

async function cargar() {
  try {
    estado.resumen = await api('/api/admin/resumen');
  } catch (error) {
    if (error.status !== 401) {
      $('#admin').innerHTML = `<div class="tarjeta"><div class="mensaje mensaje-error">${escapar(error.message)}</div></div>`;
    }
    return;
  }
  render();
}

/**
 * Refresco automático del panel.
 *
 * Dos razones: los resultados en directo se actualizan solos durante la
 * sesión y, en un alojamiento que apaga el servicio por inactividad (como el
 * plan gratuito), mantener el panel abierto mantiene el servicio despierto.
 */
let temporizadorRefresco = null;

function activarRefresco(activo) {
  if (temporizadorRefresco) {
    clearInterval(temporizadorRefresco);
    temporizadorRefresco = null;
  }
  if (!activo) return;
  temporizadorRefresco = setInterval(() => {
    // No se recarga mientras se está escribiendo un texto o hay un diálogo
    // abierto: no queremos perder lo que la persona está tecleando.
    if (document.querySelector('dialog[open]')) return;
    if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      return;
    }
    cargar();
  }, 15000);
}

function render() {
  const r = estado.resumen;
  const c = r.conservacion;

  $('#estado-purga').hidden = false;
  $('#estado-purga').textContent =
    c && c.diasRestantes !== null
      ? `Borrado automático en ${c.diasRestantes} días (${c.fechaBorrado})`
      : `Borrado automático el ${c ? c.fechaBorrado : '—'}`;

  const pestanas = [
    ['resultados', 'Resultados en directo'],
    ['guion', 'Guion «Lo esencial»'],
    ['mesas', 'Mesas y casos'],
    ['ideas', 'Ideas fuerza'],
    ['moderacion', 'Revisión de textos'],
    ['descargas', 'Descargas y privacidad'],
    ['proyector', 'Vista proyector'],
    ['checklist', 'Antes del taller']
  ];

  $('#admin').innerHTML = `
    ${avisoReinicio()}
    <div class="panel-nav">
      ${pestanas
        .map(
          ([id, titulo]) =>
            `<button type="button" data-pestana="${id}" class="${estado.pestana === id ? 'activo' : ''}">${titulo}</button>`
        )
        .join('')}
      <button type="button" data-salir="1" style="margin-left:auto">Salir</button>
    </div>
    <div class="barra-refresco">
      <label>
        <input type="checkbox" id="refresco-auto" ${estado.refrescoAuto === false ? '' : 'checked'} />
        Refrescar automáticamente cada 15 s
      </label>
      <span class="nota">Mantiene los resultados al día y, en alojamientos que apagan el servicio por inactividad, lo mantiene despierto.</span>
    </div>
    <div id="contenido-pestana">${contenidoPestana()}</div>`;

  $$('[data-pestana]').forEach((boton) => {
    boton.addEventListener('click', () => {
      estado.pestana = boton.dataset.pestana;
      render();
      // Al cambiar de pestaña se recupera el estado más reciente: durante el
      // taller llegan respuestas en todo momento y el panel no debe mostrar
      // datos caducados (por ejemplo, textos pendientes que aún no han salido).
      cargar();
    });
  });

  const refresco = $('#refresco-auto');
  if (refresco) {
    refresco.addEventListener('change', () => {
      estado.refrescoAuto = refresco.checked;
      sessionStorage.setItem('t4_refresco', refresco.checked ? 'si' : 'no');
      activarRefresco(refresco.checked);
    });
  }

  $('[data-salir]').addEventListener('click', () => {
    estado.token = null;
    sessionStorage.removeItem('t4_admin');
    renderLogin();
  });

  conectarPestana();
  activarRefresco(estado.refrescoAuto !== false);
}

/**
 * Aviso de reinicio del servicio.
 *
 * En un alojamiento sin disco persistente, cuando el servicio se duerme o se
 * reinicia se pierde todo lo que había en el sistema de ficheros. Si el
 * identificador de arranque ha cambiado desde la última visita, avisamos
 * antes de que la persona dinamizadora empiece a recoger datos pensando que
 * están los de antes.
 */
function avisoReinicio() {
  const arranque = estado.resumen && estado.resumen.arranque;
  if (!arranque || !arranque.id) return '';

  const visto = estado.arranqueVisto;
  if (visto && visto !== arranque.id) {
    return `
      <div class="aviso-reinicio">
        <strong>El servicio se ha reiniciado.</strong>
        Si el alojamiento no tiene disco persistente, las respuestas, las mesas
        y los resultados de la sesión anterior se han perdido. Si tenías una
        copia de seguridad, restáurala en «Descargas y privacidad». Si no la
        tenías, empieza de cero: sigue adelante con laYNAMIC…
      </div>`;
  }

  sessionStorage.setItem('t4_arranque', arranque.id);
  return '';
}

/* ------------------------------------------------------------------
   Contenido por pestaña
   ------------------------------------------------------------------ */

function contenidoPestana() {
  switch (estado.pestana) {
    case 'guion':
      return pestanaGuion();
    case 'checklist':
      return pestanaChecklist();
    case 'mesas':
      return pestanaMesas();
    case 'ideas':
      return pestanaIdeas();
    case 'moderacion':
      return pestanaModeracion();
    case 'descargas':
      return pestanaDescargas();
    case 'proyector':
      return pestanaProyector();
    default:
      return pestanaResultados();
  }
}

function barra(etiqueta, valor, maximo, clase = '') {
  const porcentaje = maximo ? Math.round((valor / maximo) * 100) : 0;
  return `<div class="barra">
    <span class="barra-etiqueta">${escapar(etiqueta)}</span>
    <span class="barra-pista"><span class="barra-valor ${clase}" style="width:${porcentaje}%"></span></span>
    <span class="barra-numero">${valor}</span>
  </div>`;
}

function pestanaResultados() {
  const r = estado.resumen;
  const termometro = r.termometro || {};
  const incidentes = r.incidentes || {};
  const pautas = r.pautas || {};

  const maxTermo = Math.max(1, ...Object.values(termometro), ...Object.values(pautas));
  const maxInc = Math.max(1, ...Object.values(incidentes));

  const opcionesTermo = ['Sí, con herramientas de la entidad', 'Sí, cada uno las suyas', 'No', 'No lo sé'];
  const opcionesInc = [
    'Phishing o suplantación',
    'Pérdida o robo de información o dispositivos',
    'Fraude en pagos',
    'Ninguno',
    'Prefiero no responder'
  ];
  const opcionesPautas = ['Sí, escritas', 'Informales', 'No'];

  return `
    <div class="cifras">
      <div class="cifra"><div class="valor">${r.participantes}</div><div class="etiqueta">Participantes</div></div>
      <div class="cifra"><div class="valor">${Object.keys(r.casos || {}).length ? Object.values(r.casos).reduce((a, c) => a + c.respuestas, 0) : 0}</div><div class="etiqueta">Respuestas de casos</div></div>
      <div class="cifra"><div class="valor">${r.textosPendientes}</div><div class="etiqueta">Textos por revisar</div></div>
      <div class="cifra"><div class="valor">${(r.ideas || []).length}</div><div class="etiqueta">Ideas para votar</div></div>
    </div>

    <div class="admin-rejilla">
      <section class="tarjeta">
        <div class="kicker">Termómetro · uso de IA</div>
        ${opcionesTermo.map((o) => barra(o, termometro[o] || 0, maxTermo)).join('')}
      </section>

      <section class="tarjeta">
        <div class="kicker">Termómetro · incidentes en 2 años</div>
        ${opcionesInc.map((o) => barra(o, incidentes[o] || 0, maxInc)).join('')}
      </section>

      <section class="tarjeta">
        <div class="kicker">Termómetro · pautas internas</div>
        ${opcionesPautas.map((o) => barra(o, pautas[o] || 0, maxTermo)).join('')}
      </section>

      <section class="tarjeta">
        <div class="kicker">Semáforo · 10 medidas</div>
        <table class="tabla">
          <thead><tr><th>Medida</th><th style="width:7rem">Semáforo</th><th class="num">Prioridad</th></tr></thead>
          <tbody>
            ${Object.entries(r.semaforo || {})
              .map(([n, c]) => {
                const total = (c.verde || 0) + (c.ambar || 0) + (c.rojo || 0);
                const top = Math.max(c.verde || 0, c.ambar || 0, c.rojo || 0);
                const dominante = top === (c.verde || 0) ? 'verde' : top === (c.ambar || 0) ? 'ambar' : 'rojo';
                return `<tr>
                  <td>${n}. ${escapar((r.medidasTexto || {})[n] || '')}</td>
                  <td>
                    <span class="semaforo-mini">
                      <span class="verde ${dominante === 'verde' ? 'on' : ''}"></span>
                      <span class="ambar ${dominante === 'ambar' ? 'on' : ''}"></span>
                      <span class="rojo ${dominante === 'rojo' ? 'on' : ''}"></span>
                    </span>
                    <span class="nota">${total} resp.</span>
                  </td>
                  <td class="num">${(r.prioridades || {})[n] || 0}</td>
                </tr>`;
              })
              .join('')}
          </tbody>
        </table>
        <p class="nota">Cada punto muestra la situación mayoritaria de esa medida (verde = lo tenéis, ámbar = a medias, rojo = no lo tenéis).</p>
      </section>

      <section class="tarjeta">
        <div class="kicker">Retos · por categoría</div>
        ${Object.entries(r.retos || {})
          .map(([c, n]) => barra(c, n, Math.max(1, ...Object.values(r.retos || {}))))
          .join('') || '<p class="nota">Sin datos todavía.</p>'}
      </section>

      <section class="tarjeta">
        <div class="kicker">Ideas fuerza · votación</div>
        ${(r.ideas || [])
          .slice()
          .sort((a, b) => b.votos - a.votos)
          .map((i) => barra(i.texto, i.votos, Math.max(1, ...(r.ideas || []).map((x) => x.votos))))
          .join('') || '<p class="nota">Todavía no hay ideas cargadas.</p>'}
      </section>
    </div>

    <p class="enlace-salida">Actualización automática cada 15 segundos. Última lectura: ${new Date(r.generado).toLocaleTimeString('es-ES')}.</p>
    <div class="acciones" style="margin-top:.6rem">
      <button type="button" class="boton boton-linea" id="btn-refrescar">Actualizar ahora</button>
    </div>`;
}

/* --- Mesas --- */

/* ------------------------------------------------------------------
   Guion «Lo esencial en 15 minutos» (material del ponente)
   ------------------------------------------------------------------ */

function pestanaGuion() {
  const r = estado.resumen;
  const bloques = r.bloques || [];

  return `
    <div class="admin-rejilla">
      <section class="tarjeta">
        <div class="kicker">Guion · 15 minutos</div>
        <p class="nota">Cuatro bloques de 3-4 minutos. El <strong>mensaje</strong> es lo que va en la diapositiva; la <strong>nota del ponente</strong> con la base normativa no se proyecta: úsala para responder preguntas.</p>
        ${bloques
          .map(
            (b) => `
          <article class="bloque-guion">
            <header class="bloque-guion-cab">
              <span class="bloque-letra">${escapar(b.id)}</span>
              <div>
                <h3>${escapar(b.titulo)}</h3>
                <span class="nota">${b.minutos} min</span>
              </div>
            </header>
            <blockquote class="bloque-mensaje">«${escapar(b.mensaje)}»</blockquote>
            ${
              b.puntos && b.puntos.length
                ? `<ul class="lista-simple">${b.puntos.map((p) => `<li>${escapar(p)}</li>`).join('')}</ul>`
                : ''
            }
            ${
              b.habitos && b.habitos.length
                ? `<p class="nota"><strong>Tres hábitos clave:</strong> ${b.habitos.map((h) => escapar(h)).join(' · ')}</p>`
                : ''
            }
            ${
              b.semaforoIA && b.semaforoIA.length
                ? `<div class="semaforo-ia">
                    ${b.semaforoIA
                      .map(
                        (s) => `<div class="ia-fila ia-${s.estado}">
                          <span class="ia-etiqueta">${escapar(s.titulo)}</span>
                          <span>${escapar(s.usos)}</span>
                        </div>`
                      )
                      .join('')}
                   </div>`
                : ''
            }
            <details class="nota-ponente">
              <summary>Nota del ponente · base normativa (no se proyecta)</summary>
              <p>${escapar(b.nota)}</p>
            </details>
          </article>`
          )
          .join('')}
      </section>
    </div>`;
}

/** Muestra un mensaje breve en un contenedor del panel. */
function mostrarAviso(selector, texto, tipo = 'ok') {
  const destino = $(selector);
  if (!destino) return;
  destino.innerHTML = `<div class="mensaje mensaje-${tipo === 'error' ? 'error' : 'ok'}">${escapar(
    texto
  )}</div>`;
}

function marcasVerificacion(id) {
  try {
    const marcas = JSON.parse(sessionStorage.getItem('t4_checklist') || '{}');
    return Boolean(marcas[id]);
  } catch (error) {
    return false;
  }
}

/* ------------------------------------------------------------------
   Antes del taller: objetivos, resultados y puntos a verificar
   ------------------------------------------------------------------ */

function pestanaChecklist() {
  const r = estado.resumen;
  const verificaciones = r.verificaciones || [];
  const objetivos = r.objetivos || [];
  const resultados = r.resultadosEsperados || [];

  return `
    <div class="admin-rejilla">
      <section class="tarjeta">
        <div class="kicker">Puntos que conviene verificar</div>
        <p class="nota">Del documento de preparación interna. Revísalos antes de la sesión y, si alguno ha cambiado, actualiza la presentación y el guion.</p>
        ${verificaciones
          .map(
            (v) => `
          <label class="check-verificacion">
            <input type="checkbox" data-verificacion="${escapar(v.id)}" ${marcasVerificacion(v.id) ? 'checked' : ''} />
            <span>
              <strong>${escapar(v.titulo)}</strong>
              <span class="nota">${escapar(v.detalle)}</span>
            </span>
          </label>`
          )
          .join('')}
      </section>

      <section class="tarjeta">
        <div class="kicker">Objetivos del taller</div>
        <ul class="lista-simple">${objetivos.map((o) => `<li>${escapar(o)}</li>`).join('')}</ul>

        <div class="kicker" style="margin-top:1.2rem">Resultados esperados</div>
        <ul class="lista-simple">${resultados.map((o) => `<li>${escapar(o)}</li>`).join('')}</ul>
      </section>
    </div>`;
}

function pestanaMesas() {
  const r = estado.resumen;
  const mesas = r.mesas || [];
  const casos = r.casos || {};

  return `
    <div class="admin-rejilla">
      <section class="tarjeta">
        <div class="kicker">Configuración de mesas</div>
        <table class="tabla">
          <thead><tr><th>Mesa</th><th>Caso</th><th>Respuestas</th><th></th></tr></thead>
          <tbody>
            ${mesas
              .map((m) => {
                const caso = m.caso ? casos[m.caso] : null;
                return `<tr>
                  <td><strong>${escapar(m.alias)}</strong></td>
                  <td>
                    <select data-mesa-caso="${escapar(m.alias)}">
                      <option value="">Sin asignar</option>
                      ${[1, 2, 3, 4]
                        .map((n) => `<option value="${n}" ${m.caso === n ? 'selected' : ''}>Caso ${n}</option>`)
                        .join('')}
                    </select>
                  </td>
                  <td class="num">${caso ? caso.respuestas : 0}</td>
                  <td><button type="button" class="chip" data-toggle-mesa="${escapar(m.alias)}">${m.abierta === false ? 'Abrir' : 'Cerrar'}</button></td>
                </tr>`;
              })
              .join('')}
          </tbody>
        </table>
        <div class="fila-admin" style="margin-top:.8rem">
          <input type="text" id="nueva-mesa" placeholder="Alias de la mesa (p. ej. Mesa 5)" maxlength="40" />
          <select id="nueva-mesa-caso">
            <option value="">Sin caso asignado</option>
            <option value="1">Caso 1</option>
            <option value="2">Caso 2</option>
            <option value="3">Caso 3</option>
            <option value="4">Caso 4</option>
          </select>
          <button type="button" class="boton boton-linea" id="btn-nueva-mesa" style="flex:0 0 auto">Añadir mesa</button>
        </div>
      </section>

      <section class="tarjeta">
        <div class="kicker">Respuestas por mesa</div>
        ${mesas
          .map((m) => {
            const caso = m.caso ? casos[m.caso] : null;
            if (!caso) return '';
            const latest = caso.ultima;
            return `<div class="tarjeta-mesa">
              <h4>${escapar(m.alias)} · Caso ${m.caso} · ${caso.respuestas} respuesta(s)</h4>
              ${
                latest
                  ? `<div class="bloque"><strong>¿Qué riesgo veis?</strong><p>${escapar(latest.riesgo || '—')}</p></div>
                     <div class="bloque"><strong>¿Qué haríais?</strong><p>${escapar(latest.hacer || '—')}</p></div>
                     <div class="bloque"><strong>¿Qué necesitaríais?</strong><p>${escapar(latest.necesidad || '—')}</p></div>`
                  : '<p class="nota">Sin respuestas todavía.</p>'
              }
            </div>`;
          })
          .join('') || '<p class="nota">No hay mesas configuradas.</p>'}
      </section>
    </div>

    <section class="tarjeta" style="margin-top:.85rem">
      <div class="kicker">Guía de resolución de los casos</div>
      <p class="nota">Solo para el equipo dinamizador. No se muestra en la app de participantes. La base normativa está para responder preguntas, no para proyectar.</p>
      <div id="guia-casos">${(r.guia || []).map(guiaCaso).join('')}</div>
    </section>`;
}

/* --- Ideas --- */

function pestanaIdeas() {
  const r = estado.resumen;
  const ideas = (r.ideas || []).slice().sort((a, b) => b.votos - a.votos);

  return `
    <div class="admin-rejilla">
      <section class="tarjeta">
        <div class="kicker">Votación de ideas fuerza</div>
        <p class="entradilla">La votación está <strong>${r.votacionAbierta ? 'abierta' : 'cerrada'}</strong>. Al abrirla, los participantes ven la lista y eligen dos.</p>
        <div class="acciones">
          <button type="button" class="boton ${r.votacionAbierta ? 'boton-linea' : 'boton-primario'}" id="btn-votacion">
            ${r.votacionAbierta ? 'Cerrar votación' : 'Abrir votación'}
          </button>
        </div>
        <h3 style="margin:1rem 0 .4rem">Añadir una idea</h3>
        <div class="fila-admin">
          <input type="text" id="nueva-idea" placeholder="Texto de la idea" maxlength="180" />
          <select id="categoria-idea">
            <option>Formación</option>
            <option>Recursos técnicos</option>
            <option>Asesoramiento jurídico</option>
            <option>Proveedores</option>
            <option>Financiación</option>
            <option>Cultura interna</option>
          </select>
          <button type="button" class="boton boton-linea" id="btn-nueva-idea" style="flex:0 0 auto">Añadir</button>
        </div>
        <p class="nota" style="margin-top:.6rem">Las ideas se pueden preparar en directo: recoge los retos más citados en las mesas y conviértelos en las opciones de votación.</p>
        ${
          (r.ideasSugeridas || []).length
            ? `<h3 style="margin:1rem 0 .4rem">Sugerencias para abrir la votación</h3>
               <div class="chips">${r.ideasSugeridas
                 .map(
                   (s, i) =>
                     `<button type="button" class="chip" data-anadir-sugerida="${i}">+ ${escapar(s.texto)}</button>`
                 )
                 .join('')}</div>
               <p class="nota" style="margin-top:.4rem">Se añaden a la lista de votación con un clic. Conviene sustituirlas por lo que haya salido en las mesas.</p>`
            : ''
        }
      </section>

      <section class="tarjeta">
        <div class="kicker">Ideas cargadas</div>
        ${ideas
          .map(
            (i) => `<div class="tarjeta-mesa">
              <h4>${escapar(i.texto)}</h4>
              <div class="fila-admin">
                <span class="palanca ${i.votos ? 'activo' : ''}">${i.votos} voto(s)</span>
                <span class="nota">${escapar(i.categoria || '')}</span>
                <button type="button" class="chip" data-borrar-idea="${escapar(i.id)}" style="margin-left:auto">Quitar</button>
              </div>
            </div>`
          )
          .join('') || '<p class="nota">Todavía no hay ideas cargadas.</p>'}
      </section>
    </div>`;
}

/* --- Moderación --- */

function guiaCaso(guia) {
  const r = guia.resolucion || {};
  const bloque = (titulo, lineas) =>
    lineas && lineas.length
      ? `<div class="bloque"><strong>${escapar(titulo)}</strong><ul style="margin:.15rem 0 0;padding-left:1rem">${lineas
          .map((l) => `<li>${escapar(l)}</li>`)
          .join('')}</ul></div>`
      : '';

  return `<div class="tarjeta-mesa">
    <h4>Caso ${guia.id} · ${escapar(guia.titulo)}</h4>
    <div class="bloque"><strong>Escenario</strong><p>${escapar(guia.escenario)}</p></div>
    ${bloque('Qué riesgo hay', r.riesgo)}
    ${bloque('Qué hacer', r.hacer)}
    ${bloque('Si ya ha pasado', r.siYaHaPasado)}
    ${r.norma ? `<div class="bloque"><strong>Base normativa (para preguntas)</strong><p>${escapar(r.norma)}</p></div>` : ''}
    <div class="bloque"><strong>Mensaje clave</strong><p>${escapar(guia.mensaje)}</p></div>
  </div>`;
}

function pestanaModeracion() {
  const r = estado.resumen;
  const textos = r.textos || [];
  const pendientes = textos.filter((t) => t.estado === 'pendiente');
  const revisados = textos.filter((t) => t.estado !== 'pendiente');

  const bloque = (t) => `<div class="texto-moderar">
    <div class="meta">
      ${escapar(t.campo)}${t.caso ? ` · caso ${t.caso}` : ''}${t.mesa ? ` · ${escapar(t.mesa)}` : ''}
    </div>
    <div class="contenido">${escapar(t.texto)}</div>
    <div class="fila-admin">
      <span class="estado-moderacion estado-${t.estado}">${t.estado}</span>
      ${
        t.estado !== 'aprobado'
          ? `<button type="button" class="chip" data-moderar="${escapar(t.id)}" data-estado="aprobado">Aprobar</button>`
          : ''
      }
      ${
        t.estado !== 'rechazado'
          ? `<button type="button" class="chip" data-moderar="${escapar(t.id)}" data-estado="rechazado">Rechazar</button>`
          : ''
      }
    </div>
  </div>`;

  return `
    <section class="tarjeta">
      <div class="kicker">Pendientes de revisión · ${pendientes.length}</div>
      <p class="nota">El texto libre no se exporta a la Red Solidaria hasta que se aprueba aquí. Antes de aprobar, comprueba que no hay nombres, datos de contacto ni detalles identificables.</p>
      ${pendientes.map(bloque).join('') || '<p class="nota">No hay textos pendientes.</p>'}
    </section>

    <section class="tarjeta">
      <div class="kicker">Ya revisados · ${revisados.length}</div>
      ${revisados.map(bloque).join('') || '<p class="nota">Todavía no se ha revisado ningún texto.</p>'}
    </section>`;
}

/* --- Descargas y privacidad --- */

function pestanaDescargas() {
  const r = estado.resumen;
  const c = r.conservacion;
  const url = location.origin;

  return `
    <div class="admin-rejilla">
      <section class="tarjeta">
        <div class="kicker">Código QR de acceso</div>
        <p class="nota">Proyectadlo en pantalla: los participantes lo escanean con la cámara del móvil y entran en la app. No hace falta registrarse.</p>
        <div style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap">
          <img src="/api/qr.svg" alt="Código QR de acceso a la app" width="220" height="220" style="border:1px solid var(--linea);padding:8px;background:#fff" />
          <div>
            <a class="boton boton-linea" href="/api/qr.svg" download="qr-taller4.svg" style="width:auto;margin-bottom:.4rem">Descargar SVG</a>
            <a class="boton boton-linea" href="/api/qr.png" download="qr-taller4.png" style="width:auto">Descargar PNG</a>
            <p class="nota" style="margin-top:.5rem"><a href="/cartela" target="_blank" rel="noopener">Abrir la cartela imprimible (A4)</a></p>
          </div>
        </div>
      </section>

      <section class="tarjeta">
        <div class="kicker">Datos para la Red Solidaria</div>
        <p class="nota">Exportaciones agregadas: sin seudónimos, sin respuestas individuales y con los recuentos pequeños suprimidos. El texto libre va en un fichero aparte y solo tras revisión.</p>
        <div class="acciones">
          <a class="boton boton-linea" href="/api/admin/exportar/fresno.csv" style="text-decoration:none">Resultados (CSV)</a>
          <a class="boton boton-linea" href="/api/admin/exportar/fresno.json" style="text-decoration:none">Resultados (JSON)</a>
          <a class="boton boton-linea" href="/api/admin/exportar/semaforo.csv" style="text-decoration:none">Semáforo (CSV)</a>
          <a class="boton boton-linea" href="/api/admin/exportar/textos-depurados.csv" style="text-decoration:none">Textos revisados (CSV)</a>
        </div>
      </section>

      <section class="tarjeta">
        <div class="kicker">Conservación y borrado</div>
        <table class="tabla">
          <tbody>
            <tr><td>Fecha del taller</td><td class="num">${c.fechaTaller}</td></tr>
            <tr><td>Días de conservación</td><td class="num">${c.dias}</td></tr>
            <tr><td>Borrado automático</td><td class="num">${c.fechaBorrado}</td></tr>
            <tr><td>Días restantes</td><td class="num">${c.diasRestantes}</td></tr>
          </tbody>
        </table>
        <p class="nota" style="margin-top:.6rem">El borrado elimina las respuestas y los textos revisados. Se conservan los recuentos agregados, que no son datos personales. No existe tabla de correspondencias entre seudónimo y persona.</p>
        <div class="acciones" style="margin-top:.6rem">
          <button type="button" class="boton boton-coral" id="btn-purgar">Borrar ahora los datos brutos</button>
        </div>
        <div id="aviso-purga"></div>
      </section>

      <section class="tarjeta">
        <div class="kicker">Copia de seguridad de la sesión</div>
        <p class="nota">Guarda en tu ordenador todo el estado de la sesión (respuestas, mesas, ideas, agregados y auditoría). <strong>Hazlo al terminar el taller</strong>: si el alojamiento no tiene disco persistente, los datos se pierden en cuanto el servicio se duerme, y con esta copia puedes restaurarlos.</p>
        <div class="acciones">
          <button type="button" class="boton boton-primario" id="btn-copia-descargar">Descargar copia</button>
          <button type="button" class="boton boton-linea" id="btn-copia-restaurar">Restaurar desde un fichero</button>
        </div>
        <input type="file" id="fichero-copia" accept="application/json,.json" hidden />
        <div id="aviso-copia"></div>
      </section>

      <section class="tarjeta">
        <div class="kicker">Registro de auditoría</div>
        <div id="auditoria"></div>
      </section>
    </div>`;
}

/* --- Proyector --- */

function pestanaProyector() {
  const r = estado.resumen;
  const termometro = r.termometro || {};
  const incidentes = r.incidentes || {};
  const pautas = r.pautas || {};
  const max = Math.max(1, ...Object.values(termometro), ...Object.values(incidentes), ...Object.values(pautas));

  const ideas = (r.ideas || []).slice().sort((a, b) => b.votos - a.votos).slice(0, 5);

  return `
    <section class="tarjeta proyector">
      <h2>Termómetro digital</h2>
      <div style="margin-top:1rem">
        ${Object.entries(termometro)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => barra(k, v, max))
          .join('')}
        ${Object.entries(pautas)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => barra(k, v, max))
          .join('')}
      </div>
      <h3 style="margin-top:1.6rem">Incidentes en los dos últimos años</h3>
      <div style="margin-top:.6rem">
        ${Object.entries(incidentes)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => barra(k, v, max))
          .join('')}
      </div>
      ${ideas.length ? `<h3 style="margin-top:1.6rem">Ideas fuerza</h3><div style="margin-top:.6rem">${ideas.map((i) => barra(i.texto, i.votos, max)).join('')}</div>` : ''}
      <p style="margin-top:1.6rem;color:#dae6ee;font-size:.9rem">
        ${r.participantes} participantes · ${Object.values(r.casos || {}).reduce((a, c) => a + c.respuestas, 0)} respuestas de casos
      </p>
    </section>`;
}

/* ------------------------------------------------------------------
   Interacciones
 * ------------------------------------------------------------------ */

function conectarPestana() {
  const refrescar = $('#btn-refrescar');
  if (refrescar) refrescar.addEventListener('click', cargar);

  // Copia de seguridad
  const btnCopiar = $('#btn-copia-descargar');
  if (btnCopiar) {
    btnCopiar.addEventListener('click', async () => {
      btnCopiar.disabled = true;
      try {
        const respuesta = await fetch('/api/admin/copia', {
          headers: { 'X-Admin-Token': estado.token }
        });
        if (!respuesta.ok) throw new Error('No se ha podido generar la copia.');
        const texto = await respuesta.text();
        const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `taller4-copia-${new Date().toISOString().slice(0, 10)}.json`;
        enlace.click();
        URL.revokeObjectURL(url);
        mostrarAviso('#aviso-copia', 'Copia descargada. Guárdala en un sitio seguro.', 'ok');
      } catch (error) {
        mostrarAviso('#aviso-copia', error.message, 'error');
      } finally {
        btnCopiar.disabled = false;
      }
    });
  }

  const btnRestaurar = $('#btn-copia-restaurar');
  const ficheroCopia = $('#fichero-copia');
  if (btnRestaurar && ficheroCopia) {
    btnRestaurar.addEventListener('click', () => ficheroCopia.click());
    ficheroCopia.addEventListener('change', async () => {
      const fichero = ficheroCopia.files && ficheroCopia.files[0];
      if (!fichero) return;
      const confirmar = window.confirm(
        'Restaurar la copia sobrescribirá los datos actuales de la sesión. ¿Continuar?'
      );
      if (!confirmar) {
        ficheroCopia.value = '';
        return;
      }
      try {
        const contenido = await fichero.text();
        const respuesta = await fetch('/api/admin/copia', {
          method: 'POST',
          headers: { 'X-Admin-Token': estado.token, 'Content-Type': 'application/json' },
          body: contenido
        });
        const datos = await respuesta.json();
        if (!respuesta.ok) throw new Error(datos.error || 'No se ha podido restaurar.');
        mostrarAviso(
          '#aviso-copia',
          `Copia restaurada: ${datos.sesiones} sesiones, ${datos.mesas} mesas y ${datos.ideas} ideas.`,
          'ok'
        );
        await cargar();
      } catch (error) {
        mostrarAviso('#aviso-copia', error.message, 'error');
      } finally {
        ficheroCopia.value = '';
      }
    });
  }

  // Lista de verificación previa: las marcas se guardan solo en la sesión del
  // navegador (no se envían al servidor) para no perderlas al recargar.
  $$('[data-verificacion]').forEach((caja) => {
    caja.addEventListener('change', () => {
      let marcas = {};
      try {
        marcas = JSON.parse(sessionStorage.getItem('t4_checklist') || '{}');
      } catch (error) {
        marcas = {};
      }
      marcas[caja.dataset.verificacion] = caja.checked;
      sessionStorage.setItem('t4_checklist', JSON.stringify(marcas));
    });
  });

  // Mesas
  const nuevaMesa = $('#btn-nueva-mesa');
  if (nuevaMesa) {
    nuevaMesa.addEventListener('click', async () => {
      const alias = $('#nueva-mesa').value.trim();
      const caso = $('#nueva-mesa-caso').value;
      if (!alias) return;
      try {
        await api('/api/admin/mesas', { method: 'POST', body: { alias, caso: caso ? Number(caso) : null } });
        await cargar();
      } catch (error) {
        alert(error.message);
      }
    });
  }
  $$('[data-mesa-caso]').forEach((select) => {
    select.addEventListener('change', async () => {
      try {
        await api(`/api/admin/mesas/${encodeURIComponent(select.dataset.mesaCaso)}`, {
          method: 'PATCH',
          body: { caso: select.value ? Number(select.value) : null }
        });
        await cargar();
      } catch (error) {
        alert(error.message);
      }
    });
  });
  $$('[data-toggle-mesa]').forEach((boton) => {
    boton.addEventListener('click', async () => {
      const alias = boton.dataset.toggleMesa;
      const mesa = (estado.resumen.mesas || []).find((m) => m.alias === alias);
      try {
        await api(`/api/admin/mesas/${encodeURIComponent(alias)}`, {
          method: 'PATCH',
          body: { abierta: mesa ? mesa.abierta === false : true }
        });
        await cargar();
      } catch (error) {
        alert(error.message);
      }
    });
  });

  // Ideas
  const nuevaIdea = $('#btn-nueva-idea');
  if (nuevaIdea) {
    nuevaIdea.addEventListener('click', async () => {
      const texto = $('#nueva-idea').value.trim();
      if (!texto) return;
      try {
        await api('/api/admin/ideas', { method: 'POST', body: { texto, categoria: $('#categoria-idea').value } });
        await cargar();
      } catch (error) {
        alert(error.message);
      }
    });
  }
  $$('[data-anadir-sugerida]').forEach((boton) => {
    boton.addEventListener('click', async () => {
      const sugerida = (estado.resumen.ideasSugeridas || [])[Number(boton.dataset.anadirSugerida)];
      if (!sugerida) return;
      try {
        await api('/api/admin/ideas', {
          method: 'POST',
          body: { texto: sugerida.texto, categoria: sugerida.categoria }
        });
        await cargar();
      } catch (error) {
        alert(error.message);
      }
    });
  });
  $$('[data-borrar-idea]').forEach((boton) => {
    boton.addEventListener('click', async () => {
      try {
        await api(`/api/admin/ideas/${encodeURIComponent(boton.dataset.borrarIdea)}`, { method: 'DELETE' });
        await cargar();
      } catch (error) {
        alert(error.message);
      }
    });
  });
  const btnVotacion = $('#btn-votacion');
  if (btnVotacion) {
    btnVotacion.addEventListener('click', async () => {
      try {
        await api('/api/admin/votacion', {
          method: 'POST',
          body: { abierta: !estado.resumen.votacionAbierta }
        });
        await cargar();
      } catch (error) {
        alert(error.message);
      }
    });
  }

  // Moderación
  $$('[data-moderar]').forEach((boton) => {
    boton.addEventListener('click', async () => {
      try {
        await api(`/api/admin/textos/${encodeURIComponent(boton.dataset.moderar)}`, {
          method: 'POST',
          body: { estado: boton.dataset.estado }
        });
        await cargar();
      } catch (error) {
        alert(error.message);
      }
    });
  });

  // Purga
  const btnPurgar = $('#btn-purgar');
  if (btnPurgar) {
    btnPurgar.addEventListener('click', async () => {
      if (!confirm('Se borrarán todas las respuestas y los textos revisados. Los recuentos agregados se conservan. ¿Continuar?')) return;
      try {
        const resultado = await api('/api/admin/purgar', { method: 'POST' });
        $('#aviso-purga').innerHTML = `<div class="mensaje mensaje-ok">Borrado realizado: ${resultado.sesionesBorradas} sesión(es) y ${resultado.textosBorrados} texto(s) eliminados. Constancia en el registro de auditoría.</div>`;
        await cargar();
      } catch (error) {
        $('#aviso-purga').innerHTML = `<div class="mensaje mensaje-error">${escapar(error.message)}</div>`;
      }
    });
  }
}

/* ------------------------------------------------------------------
   Guía de resolución (solo dinamizador)
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------
   Arranque
 * ------------------------------------------------------------------ */

async function cargarAuditoria() {
  const destino = $('#auditoria');
  if (!destino) return;
  try {
    const datos = await api('/api/admin/auditoria');
    destino.innerHTML = `<table class="tabla">
      <thead><tr><th>Fecha</th><th>Evento</th><th>Detalle</th></tr></thead>
      <tbody>${datos.entradas
        .map(
          (e) => `<tr>
            <td class="nota">${e.fecha ? new Date(e.fecha).toLocaleString('es-ES') : '—'}</td>
            <td><strong>${escapar(e.evento)}</strong></td>
            <td class="nota">${escapar(
              Object.entries(e)
                .filter(([k]) => !['fecha', 'evento'].includes(k))
                .map(([k, v]) => `${k}: ${v}`)
                .join(' · ')
            )}</td>
          </tr>`
        )
        .join('')}</tbody>
    </table>`;
  } catch {
    destino.innerHTML = '<p class="nota">No se ha podido cargar el registro.</p>';
  }
}

const observer = new MutationObserver(() => {
  if (estado.pestana === 'descargas' && $('#auditoria') && !$('#auditoria').dataset.cargado) {
    $('#auditoria').dataset.cargado = '1';
    cargarAuditoria();
  }
});

observer.observe(document.body, { childList: true, subtree: true });

if (estado.token) {
  cargar();
} else {
  renderLogin();
}

setInterval(() => {
  if (estado.token && estado.pestana !== 'descargas') cargar();
}, 15000);
