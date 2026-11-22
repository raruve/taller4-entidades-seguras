/* ==================================================================
   App de participantes · Taller 4
   Red Solidaria Santander · Pérez-Llorca

   Sin cookies, sin analítica, sin peticiones a terceros. El único dato
   que se conserva en el navegador es el código de sesión (sessionStorage),
   necesario para poder retomar la respuesta si se recarga la página.
   ================================================================== */

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin caracteres ambiguos

const VISTAS = ['inicio', 'termometro', 'mesas', 'semaforo', 'retos', 'cierre'];

const estado = {
  config: null,
  codigo: null,
  vista: 'inicio',
  respuestas: { termometro: null, mesa: null, semaforo: null, retos: null },
  mesas: [],
  ideas: [],
  votacionAbierta: false,
  cargando: false
};

/* ------------------------------------------------------------------
   Utilidades
   ------------------------------------------------------------------ */

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

/** Base64 que respeta UTF-8, sin depender de escape/unescape. */
function codificarBase64(texto) {
  const bytes = new TextEncoder().encode(texto);
  let binario = '';
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario);
}

function generarCodigo() {
  const valores = new Uint8Array(8);
  crypto.getRandomValues(valores);
  const chars = Array.from(valores, (v) => ALFABETO[v % ALFABETO.length]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

function codigoSesion() {
  let codigo = sessionStorage.getItem('t4_codigo');
  if (!codigo) {
    codigo = generarCodigo();
    sessionStorage.setItem('t4_codigo', codigo);
  }
  return codigo;
}

async function api(ruta, opciones = {}) {
  const separador = ruta.includes('?') ? '&' : '?';
  const url = `${ruta}${separador}codigo=${encodeURIComponent(codigoSesion())}`;
  const respuesta = await fetch(url, {
    method: opciones.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
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
    throw Object.assign(new Error(datos.error || 'No se ha podido guardar la respuesta.'), { status: respuesta.status });
  }
  return datos;
}

/**
 * Detector de posible información personal en texto libre.
 * No sustituye a la revisión del dinamizador: solo avisa en el momento.
 */
function detectarDatosPersonales(texto) {
  const avisos = [];
  if (!texto) return avisos;
  if (/\b[\w.%+-]+@[\w.-]+\.[a-z]{2,}\b/i.test(texto)) avisos.push('parece un correo electrónico');
  if (/(?:\+34[\s-]?)?\b[6-9]\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/.test(texto)) avisos.push('parece un teléfono');
  if (/\b(?:\d{8}|\d{9}|IBAN|ES\d{2}[\s\d]{20})\b/i.test(texto)) avisos.push('parece un número de cuenta o IBAN');
  if (/https?:\/\//i.test(texto)) avisos.push('contiene un enlace web');
  if (/\b\d{1,3}\s+de\s+\d{4}\s+de\s+\d{4}\b/.test(texto)) avisos.push('parece una fecha completa');
  return avisos;
}

/* ------------------------------------------------------------------
   Navegación
   ------------------------------------------------------------------ */

function irA(vista, { reemplazar = false } = {}) {
  if (!VISTAS.includes(vista)) vista = 'inicio';
  estado.vista = vista;
  const hash = `#/${vista}`;
  if (location.hash !== hash) {
    if (reemplazar) history.replaceState(null, '', hash);
    else history.pushState(null, '', hash);
  }
  render();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

function vistaDeHash() {
  const v = (location.hash || '').replace(/^#\/?/, '').split('/')[0];
  return VISTAS.includes(v) ? v : 'inicio';
}

/* ------------------------------------------------------------------
   Render
   ------------------------------------------------------------------ */

function pintarPasos() {
  const indice = VISTAS.indexOf(estado.vista);
  const contenedor = $('#pasos');
  contenedor.innerHTML = VISTAS.slice(1)
    .map((v, i) => {
      const pos = i + 1;
      const clase = pos === indice ? 'activo' : pos < indice ? 'hecho' : '';
      return `<span class="paso ${clase}"></span>`;
    })
    .join('');
}

function pintarNavegacion() {
  const nav = $('#nav-inferior');
  const indice = VISTAS.indexOf(estado.vista);
  if (estado.vista === 'inicio' || estado.vista === 'cierre') {
    nav.hidden = true;
    return;
  }
  nav.hidden = false;
  $('#contador-paso').textContent = `${indice} de ${VISTAS.length - 1}`;
  $('#btn-atras').disabled = indice <= 1;
  $('#btn-siguiente').textContent = indice >= VISTAS.length - 1 ? 'Ver cierre' : 'Continuar';
}

function render() {
  pintarPasos();
  pintarNavegacion();
  const app = $('#app');
  const vista = estado.vista;
  if (vista === 'inicio') app.innerHTML = vistaInicio();
  else if (vista === 'termometro') app.innerHTML = vistaTermometro();
  else if (vista === 'mesas') app.innerHTML = vistaMesas();
  else if (vista === 'semaforo') app.innerHTML = vistaSemaforo();
  else if (vista === 'retos') app.innerHTML = vistaRetos();
  else if (vista === 'cierre') app.innerHTML = vistaCierre();
  conectarEventos();
}

function pieHtml() {
  return `
    <div class="pie">
      <img src="/assets/pll-logo.svg" alt="Pérez-Llorca" />
    </div>`;
}

/* ------------------------------------------------------------------
   Vista: inicio
   ------------------------------------------------------------------ */

function vistaInicio() {
  const c = estado.config;

  const agenda = c.agenda
    .map((a) => {
      const destino = a.vista || '';
      return `<li>
        <button type="button" class="agenda-enlace" data-ir="${escapar(destino)}"${destino ? '' : ' disabled'}>
          <span class="min">${a.min}′</span>
          <span class="texto-agenda">
            <strong>${escapar(a.titulo)}</strong>
            <span class="detalle">${escapar(a.detalle)}</span>
          </span>
          <span class="flecha" aria-hidden="true">›</span>
        </button>
      </li>`;
    })
    .join('');

  return `
    <section class="portada">
      <div class="kicker">${escapar(c.evento.taller)} · ${escapar(c.evento.red)}</div>
      <h2 class="titulo-grande">${escapar(c.evento.titulo)}</h2>
      <p class="subtitulo">${escapar(c.evento.subtitulo)}</p>

      <div class="tarjeta">
        <div class="kicker">Cómo va a funcionar</div>
        <p class="nota intro-agenda">Toca un momento para ir directamente a esa parte del taller.</p>
        <ul class="agenda">${agenda}</ul>
        <div class="sellos">
          <span class="sello">Sin registro</span>
          <span class="sello">Sin cookies</span>
          <span class="sello">Sin datos personales</span>
          <span class="sello">Se borra a los 10 días</span>
        </div>
      </div>

      <div class="tarjeta">
        <div class="kicker">Antes de empezar</div>
        <p class="nota">${escapar(c.infoLegalCorta)}</p>
        <p class="legal-enlace">
          <a href="/legal" target="_blank" rel="noopener">Ver toda la información sobre el tratamiento de datos</a>
        </p>
      </div>

      <div class="acciones-inicio">
        <button type="button" class="boton boton-primario" data-ir="termometro">Empezar</button>
        <button type="button" class="boton boton-plano" data-ir="cierre">Ver el cierre del taller</button>
      </div>

      <div class="acceso-qr">
        <img src="/api/qr.svg" alt="Código QR de acceso a la app" />
        <p class="qr-texto">
          <strong>Entra desde el móvil</strong>
          Escanea este código con la cámara para abrir la app en el teléfono.
          ${c.urlPublica ? `<span class="qr-url">${escapar(c.urlPublica)}</span>` : ''}
        </p>
      </div>

      ${pieHtml()}
    </section>`;
}

/* ------------------------------------------------------------------
   Vista: termómetro
   ------------------------------------------------------------------ */

function vistaTermometro() {
  const c = estado.config;
  const guardada = estado.respuestas.termometro || {};

  const preguntas = c.termometro
    .map((q, i) => {
      const tipo = q.tipo === 'varias' ? 'checkbox' : 'radio';
      const nombre = `q_${q.id}`;
      const marcadas = q.tipo === 'varias' ? guardada[q.id] || [] : [];
      const opciones = q.opciones
        .map((op) => {
          const marcada =
            q.tipo === 'varias' ? marcadas.includes(op) : guardada[q.id] === op;
          return `<label class="opcion">
            <input type="${tipo}" name="${nombre}" value="${escapar(op)}" ${marcada ? 'checked' : ''} />
            <span>${escapar(op)}</span>
          </label>`;
        })
        .join('');
      return `<div class="pregunta">
        <span class="pregunta-num">${i + 1}</span>
        <div style="flex:1">
          <div class="pregunta-texto">${escapar(q.pregunta)}</div>
          ${opciones}
        </div>
      </div>`;
    })
    .join('');

  return `
    <section class="tarjeta">
      <div class="kicker">Termómetro digital · 10 min</div>
      <h2>¿Dónde estamos?</h2>
      <p class="entradilla">Tres preguntas rápidas para situar al grupo. Respuestas anónimas.</p>
      <form id="form-termometro">
        ${preguntas}
        <div id="aviso-termometro"></div>
        <button type="submit" class="boton boton-primario">Enviar respuestas</button>
      </form>
    </section>
    ${pieHtml()}`;
}

/* ------------------------------------------------------------------
   Vista: mesas (casos)
   ------------------------------------------------------------------ */

function vistaMesas() {
  const c = estado.config;
  const guardada = estado.respuestas.mesa || {};
  const mesas = estado.mesas;

  const opcionMesa = mesas.length
    ? mesas
        .map(
          (m) => `<button type="button" class="chip ${guardada.mesa === m.alias ? 'activo' : ''}"
            data-mesa="${escapar(m.alias)}" data-caso="${m.caso || ''}"
            aria-pressed="${guardada.mesa === m.alias}">${escapar(m.alias)}${m.caso ? ` · Caso ${m.caso}` : ''}</button>`
        )
        .join('')
    : '<span class="nota">Todavía no hay mesas abiertas. Puedes trabajar sin indicar mesa.</span>';

  const casos = c.casos
    .map(
      (caso) => `<button type="button" class="chip ${Number(guardada.caso) === caso.id ? 'activo' : ''}"
        data-caso="${caso.id}" aria-pressed="${Number(guardada.caso) === caso.id}">Caso ${caso.id}</button>`
    )
    .join('');

  const casoActivo = c.casos.find((x) => x.id === Number(guardada.caso));
  const contenidoCaso = casoActivo
    ? `
      <div class="tarjeta">
        <div class="kicker">Escenario · Caso ${casoActivo.id}</div>
        <h2>${escapar(casoActivo.titulo)}</h2>
        <p style="font-size:.95rem">${escapar(casoActivo.escenario)}</p>
      </div>

      <div class="caja-aviso">
        <strong>Antes de escribir, leed esto:</strong> ${escapar(c.aviso)}
      </div>

      <form id="form-mesa">
        ${casoActivo.preguntas
          .map(
            (p) => `<div class="campo-bloque">
              <label class="campo" for="mesa-${p.id}">${escapar(p.etiqueta)}</label>
              <textarea id="mesa-${p.id}" data-campo="${p.id}" rows="3" maxlength="600"
                placeholder="Respuesta de la mesa…">${escapar(guardada[p.id] || '')}</textarea>
              <div class="contador" data-contador="${p.id}">0 / 600</div>
              <div class="alerta-datos" data-alerta="${p.id}" hidden></div>
            </div>`
          )
          .join('')}
        <div class="campo-bloque">
          <label class="campo">¿Cómo registramos la respuesta?</label>
          <div class="chips">
            <button type="button" class="chip ${guardada.modo !== 'individual' ? 'activo' : ''}" data-modo="mesa" aria-pressed="${guardada.modo !== 'individual'}">Respuesta conjunta de la mesa</button>
            <button type="button" class="chip ${guardada.modo === 'individual' ? 'activo' : ''}" data-modo="individual" aria-pressed="${guardada.modo === 'individual'}">Respuesta individual</button>
          </div>
        </div>
        <label class="check">
          <input type="checkbox" id="check-mesa" />
          <span>He revisado que en estas respuestas no hay nombres, datos de contacto ni detalles que permitan identificar a personas o incidentes concretos.</span>
        </label>
        <div id="aviso-mesa"></div>
        <button type="submit" class="boton boton-primario">Guardar respuestas de la mesa</button>
      </form>`
    : `<div class="tarjeta">
        <div class="kicker">Elección de mesa</div>
        <h2>¿En qué mesa estáis?</h2>
        <p class="entradilla">Elegid la mesa que os ha asignado la dinamización.</p>
        <div class="chips">${opcionMesa}</div>
        <h3 style="margin:1.2rem 0 .5rem">Escenario</h3>
        <p class="nota">Si tu mesa tiene un escenario asignado, se abrirá automáticamente. Si no, elige uno:</p>
        <div class="chips">${casos}</div>
        <div id="aviso-mesa-sel"></div>
      </div>`;

  return `
    <section class="tarjeta">
      <div class="kicker">Casos en mesas · 20 min</div>
      <h2>Un escenario real</h2>
      <p class="entradilla">Grupos de 4-5 personas. Registrad aquí las conclusiones de vuestra mesa.</p>
    </section>
    ${contenidoCaso}
    ${pieHtml()}`;
}

/* ------------------------------------------------------------------
   Vista: semáforo
   ------------------------------------------------------------------ */

function vistaSemaforo() {
  const c = estado.config;
  const guardado = estado.respuestas.semaforo || { medidas: {}, prioridades: [] };
  const medidas = guardado.medidas || {};
  const prioridades = guardadasPrioridades(guardado.prioridades || []);

  const filas = c.semaforo
    .map((m) => {
      const estadoMedida = medidas[String(m.n)] || '';
      const botones = c.estadosSemaforo
        .map(
          (e) => `<button type="button" class="semaforo-boton" data-estado="${e.valor}" data-medida="${m.n}"
            aria-pressed="${estadoMedida === e.valor}">
            <span class="punto"></span><span>${escapar(e.corto)}</span>
          </button>`
        )
        .join('');
      const elegida = prioridades.includes(m.n);
      return `<div class="medida">
        <div class="medida-titulo">
          <span class="medida-num">${m.n}</span>
          <span class="medida-texto">${escapar(m.medida)}</span>
        </div>
        <p class="medida-pista">Verde si… ${escapar(m.verdeSi)}</p>
        <div class="semaforo-fila">${botones}</div>
        <label class="opcion" style="margin-left:2.05rem;margin-top:.3rem">
          <input type="checkbox" data-prioridad="${m.n}" ${elegida ? 'checked' : ''} />
          <span>Elegir como prioridad (máx. 3)</span>
        </label>
      </div>`;
    })
    .join('');

  const nPrioridades = prioridades.length;

  return `
    <section class="tarjeta">
      <div class="kicker">Autodiagnóstico · 10 min</div>
      <h2>Nuestro semáforo</h2>
      <p class="entradilla">Marcad cada medida en verde, ámbar o rojo y elegid tres prioridades.</p>
      <div class="chips" style="margin-bottom:.5rem">
        <span class="chip" style="pointer-events:none">Verde: lo tenemos</span>
        <span class="chip" style="pointer-events:none">Ámbar: a medias</span>
        <span class="chip" style="pointer-events:none">Rojo: no lo tenemos</span>
      </div>
    </section>
    <section class="tarjeta">${filas}</section>
    <section class="tarjeta">
      <div class="kicker">Tres prioridades</div>
      <h2 id="titulo-prioridades">${nPrioridades}/3 prioridades elegidas</h2>
      <p class="nota">Descargad el autodiagnóstico para llevároslo y compartirlo con el equipo.</p>
      <div id="aviso-semaforo"></div>
      <div class="acciones">
        <button type="button" class="boton boton-linea" id="btn-descargar">Ver autodiagnóstico</button>
        <button type="button" class="boton boton-primario" id="btn-guardar-semaforo">Guardar</button>
      </div>
    </section>
    ${pieHtml()}`;
}

function guardadasPrioridades(lista) {
  return Array.isArray(lista) ? lista.map(Number).filter(Boolean) : [];
}

/* ------------------------------------------------------------------
   Vista: retos e ideas fuerza
   ------------------------------------------------------------------ */

function vistaRetos() {
  const c = estado.config;
  const guardado = estado.respuestas.retos || {};
  const categorias = guardado.categorias || [];

  const chips = c.categoriasReto
    .map(
      (cat) => `<button type="button" class="chip" data-categoria="${escapar(cat)}"
        aria-pressed="${categorias.includes(cat)}">${escapar(cat)}</button>`
    )
    .join('');

  const bloqueVotacion = estado.votacionAbierta
    ? `<section class="tarjeta">
        <div class="kicker">Ideas fuerza · votación abierta</div>
        <h2>Elegid las dos ideas fuerza</h2>
        <p class="entradilla">De entre las propuestas recogidas en las mesas, seleccionad las dos que más pesan.</p>
        <div class="chips">${estado.ideas
          .map(
            (i) => `<button type="button" class="chip" data-idea="${escapar(i.id)}"
              aria-pressed="false">${escapar(i.texto)}</button>`
          )
          .join('')}</div>
        <div id="aviso-voto"></div>
        <button type="button" class="boton boton-primario" id="btn-votar" style="margin-top:.8rem">Confirmar mi voto</button>
      </section>`
    : `<section class="tarjeta">
        <div class="kicker">Ideas fuerza</div>
        <h2>Las dos ideas fuerza del taller</h2>
        <p class="entradilla">La votación se abre al final de la sesión. ${estado.ideas.length ? '' : 'Todavía no hay propuestas cargadas.'}</p>
        ${estado.ideas.length
          ? `<ul class="agenda">${estado.ideas
              .map(
                (i) => `<li><span class="min">★</span><span>${escapar(i.texto)}<span class="detalle">${escapar(i.categoria || '')}</span></span></li>`
              )
              .join('')}</ul>`
          : ''}
      </section>`;

  return `
    <section class="tarjeta">
      <div class="kicker">Retos e ideas fuerza · 10 min</div>
      <h2>¿Qué necesita el sector?</h2>
      <p class="entradilla">Marcad las áreas donde más necesitáis apoyo. Vuestras respuestas alimentan la agenda de la Red Solidaria para 2027.</p>
      <div class="chips">${chips}</div>

      <div class="campo-bloque" style="margin-top:1rem">
        <label class="campo" for="campo-reto">¿Cuál es vuestro reto principal? (opcional)</label>
        <textarea id="campo-reto" rows="3" maxlength="400" placeholder="Una frase, sin nombres ni datos concretos.">${escapar(guardado.reto || '')}</textarea>
        <div class="contador" data-contador="reto">0 / 400</div>
        <div class="alerta-datos" data-alerta="reto" hidden></div>
      </div>

      <div class="caja-aviso">${escapar(c.aviso)}</div>
      <div id="aviso-retos"></div>
      <button type="button" class="boton boton-primario" id="btn-guardar-retos">Guardar retos</button>
    </section>
    ${bloqueVotacion}
    ${pieHtml()}`;
}

/* ------------------------------------------------------------------
   Vista: cierre
   ------------------------------------------------------------------ */

function vistaCierre() {
  const c = estado.config;
  const semaforo = estado.respuestas.semaforo;
  const prioridades = guardadasPrioridades(semaforo?.prioridades || []);
  const detalle = prioridades
    .map((n) => {
      const m = c.semaforo.find((x) => x.n === n);
      return m ? `<li><strong>Medida ${m.n}.</strong> ${escapar(m.medida)}</li>` : '';
    })
    .join('');

  const mensajes = c.mensajesCierre.map((m) => `<li>${escapar(m)}</li>`).join('');

  return `
    <section class="portada">
      <div class="kicker">Cierre</div>
      <h2 class="titulo-grande">Lo que os lleváis hoy</h2>
      <p class="subtitulo">Gracias por participar. Todo lo que habéis respondido se borra a los 10 días; solo se conservan los recuentos agregados.</p>

      <div class="tarjeta">
        <div class="kicker">Vuestro semáforo</div>
        ${detalle ? `<h3>Vuestras tres prioridades</h3><ul style="font-size:.9rem">${detalle}</ul>` : '<p class="nota">No habéis guardado todavía el autodiagnóstico. Podéis hacerlo en el paso anterior.</p>'}
        <div class="acciones" style="margin-top:.8rem">
          <button type="button" class="boton boton-linea" data-ir="semaforo">Ir al semáforo</button>
        </div>
      </div>

      <div class="tarjeta">
        <div class="kicker">Cuatro mensajes para recordar</div>
        <ul style="font-size:.92rem">${mensajes}</ul>
      </div>

      <div class="tarjeta">
        <div class="kicker">Privacidad</div>
        <p class="nota">${escapar(c.infoLegalCorta)}</p>
        <details class="legal-detall">
          <summary>Más información sobre el tratamiento de datos</summary>
          <div class="legal">${c.infoLegalLarga
            .map((b) => `<h4>${escapar(b.titulo)}</h4><p>${escapar(b.texto)}</p>`)
            .join('')}</div>
        </details>
      </div>

      <a class="boton boton-linea" href="/legal" target="_blank" rel="noopener">Texto completo de la información legal</a>
      ${pieHtml()}
    </section>`;
}

/* ------------------------------------------------------------------
   Eventos
   ------------------------------------------------------------------ */

function conectarEventos() {
  $$('[data-ir]').forEach((boton) => {
    boton.addEventListener('click', () => irA(boton.dataset.ir));
  });

  const formTermometro = $('#form-termometro');
  if (formTermometro) formTermometro.addEventListener('submit', enviarTermometro);

  const formMesa = $('#form-mesa');
  if (formMesa) formMesa.addEventListener('submit', enviarMesa);

  $$('[data-caso]').forEach((boton) => {
    boton.addEventListener('click', () => {
      const caso = Number(boton.dataset.caso);
      const mesa = boton.dataset.mesa
        ? estado.mesas.find((m) => m.alias === boton.dataset.mesa)
        : null;
      const guardado = estado.respuestas.mesa || {};
      estado.respuestas.mesa = {
        ...guardado,
        caso,
        mesa: mesa ? mesa.alias : guardado.mesa || ''
      };
      render();
    });
  });

  $$('[data-mesa]').forEach((boton) => {
    boton.addEventListener('click', () => {
      const alias = boton.dataset.mesa;
      const mesa = estado.mesas.find((m) => m.alias === alias);
      const guardado = estado.respuestas.mesa || {};
      estado.respuestas.mesa = {
        ...guardado,
        mesa: alias,
        caso: mesa && mesa.caso ? mesa.caso : guardado.caso
      };
      render();
    });
  });

  $$('[data-modo]').forEach((boton) => {
    boton.addEventListener('click', () => {
      estado.respuestas.mesa = { ...(estado.respuestas.mesa || {}), modo: boton.dataset.modo };
      render();
    });
  });

  $$('textarea[data-campo], textarea#campo-reto').forEach((area) => {
    const id = area.dataset.campo || 'reto';
    const limite = area.getAttribute('maxlength');
    const actualizar = () => {
      const contador = $(`[data-contador="${id}"]`);
      if (contador) contador.textContent = `${area.value.length} / ${limite}`;
      const alerta = $(`[data-alerta="${id}"]`);
      if (alerta) {
        const avisos = detectarDatosPersonales(area.value);
        alerta.hidden = avisos.length === 0;
        alerta.textContent = avisos.length
          ? `Revisa esto antes de enviar: ${avisos.join(', ')}. La app avisa, pero la revisión final la hace la dinamización.`
          : '';
      }
    };
    area.addEventListener('input', actualizar);
    actualizar();
  });

  $$('.semaforo-boton').forEach((boton) => {
    boton.addEventListener('click', () => {
      const n = boton.dataset.medida;
      const guardado = estado.respuestas.semaforo || { medidas: {}, prioridades: [] };
      const medidas = { ...(guardado.medidas || {}) };
      medidas[n] = medidas[n] === boton.dataset.estado ? '' : boton.dataset.estado;
      estado.respuestas.semaforo = { ...guardado, medidas };
      render();
    });
  });

  $$('[data-prioridad]').forEach((casilla) => {
    casilla.addEventListener('change', () => {
      const guardado = estado.respuestas.semaforo || { medidas: {}, prioridades: [] };
      const prioridades = guardadasPrioridades(guardado.prioridades);
      const n = Number(casilla.dataset.prioridad);
      if (casilla.checked) {
        if (prioridades.length >= 3) {
          casilla.checked = false;
          mostrarAviso(
            '#aviso-semaforo',
            'Ya has elegido tres prioridades. Desmarca una para cambiarla.',
            'error'
          );
          return;
        }
        prioridades.push(n);
      } else {
        const i = prioridades.indexOf(n);
        if (i >= 0) prioridades.splice(i, 1);
      }
      estado.respuestas.semaforo = { ...guardado, prioridades };
      render();
    });
  });

  const btnDescargar = $('#btn-descargar');
  if (btnDescargar) btnDescargar.addEventListener('click', descargarAutodiagnostico);

  const btnGuardarSemaforo = $('#btn-guardar-semaforo');
  if (btnGuardarSemaforo) btnGuardarSemaforo.addEventListener('click', guardarSemaforo);

  const btnGuardarRetos = $('#btn-guardar-retos');
  if (btnGuardarRetos) btnGuardarRetos.addEventListener('click', guardarRetos);

  $$('[data-categoria]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const guardado = estado.respuestas.retos || { categorias: [], reto: '' };
      const categorias = [...(guardado.categorias || [])];
      const cat = chip.dataset.categoria;
      const i = categorias.indexOf(cat);
      if (i >= 0) categorias.splice(i, 1);
      else categorias.push(cat);
      estado.respuestas.retos = { ...guardado, categorias };
      render();
    });
  });

  $$('[data-idea]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const pressed = chip.getAttribute('aria-pressed') === 'true';
      const marcadas = $$('[data-idea][aria-pressed="true"]');
      if (!pressed && marcadas.length >= 2) {
        mostrarAviso('#aviso-voto', 'Solo puedes elegir dos ideas fuerza.', 'error');
        return;
      }
      chip.setAttribute('aria-pressed', String(!pressed));
    });
  });

  const btnVotar = $('#btn-votar');
  if (btnVotar) btnVotar.addEventListener('click', enviarVotacion);
}

function mostrarAviso(selector, texto, tipo = 'ok') {
  const destino = $(selector);
  if (!destino) return;
  destino.innerHTML = `<div class="mensaje mensaje-${tipo === 'error' ? 'error' : 'ok'}">${escapar(texto)}</div>`;
  destino.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ------------------------------------------------------------------
   Guardado
   ------------------------------------------------------------------ */

async function enviarTermometro(evento) {
  evento.preventDefault();
  const formulario = evento.target;
  const datos = {};
  for (const pregunta of estado.config.termometro) {
    const campos = $$(`input[name="q_${pregunta.id}"]`, formulario);
    if (pregunta.tipo === 'varias') {
      datos[pregunta.id] = campos.filter((c) => c.checked).map((c) => c.value);
    } else {
      const marcado = campos.find((c) => c.checked);
      if (marcado) datos[pregunta.id] = marcado.value;
    }
  }
  if (!datos.ia || !datos.pautas) {
    mostrarAviso('#aviso-termometro', 'Contesta las tres preguntas para continuar.', 'error');
    return;
  }
  formulario.classList.add('cargando');
  try {
    estado.respuestas.termometro = await api('/api/respuestas/termometro', { method: 'POST', body: datos });
    mostrarAviso('#aviso-termometro', '¡Gracias! Ya estáis situados. Seguimos con los casos.', 'ok');
    setTimeout(() => irA('mesas'), 700);
  } catch (error) {
    mostrarAviso('#aviso-termometro', error.message, 'error');
  } finally {
    formulario.classList.remove('cargando');
  }
}

async function enviarMesa(evento) {
  evento.preventDefault();
  const formulario = evento.target;
  const guardado = estado.respuestas.mesa || {};
  if (!guardado.caso) {
    mostrarAviso('#aviso-mesa', 'Primero elegid un escenario.', 'error');
    return;
  }
  if (!$('#check-mesa').checked) {
    mostrarAviso('#aviso-mesa', 'Marca la casilla de revisión antes de enviar.', 'error');
    return;
  }
  const cuerpo = {
    caso: guardado.caso,
    mesa: guardado.mesa || '',
    modo: guardado.modo || 'mesa',
    riesgo: $('[data-campo="riesgo"]').value,
    hacer: $('[data-campo="hacer"]').value,
    necesidad: $('[data-campo="necesidad"]').value
  };
  formulario.classList.add('cargando');
  try {
    estado.respuestas.mesa = await api('/api/respuestas/mesa', { method: 'POST', body: cuerpo });
    const caso = estado.config.casos.find((c) => c.id === Number(cuerpo.caso));
    const destino = $('#aviso-mesa');
    if (destino) {
      destino.innerHTML = `<div class="mensaje mensaje-ok">
        <h3>Respuestas guardadas</h3>
        <p>La dinamización las verá en la puesta en común.</p>
      </div>
      <div class="mensaje-clave">${escapar(caso ? caso.mensaje : '')}</div>`;
    }
  } catch (error) {
    mostrarAviso('#aviso-mesa', error.message, 'error');
  } finally {
    formulario.classList.remove('cargando');
  }
}

async function guardarSemaforo() {
  const guardado = estado.respuestas.semaforo || { medidas: {}, prioridades: [] };
  const medidas = {};
  for (const [n, estadoMedida] of Object.entries(guardado.medidas || {})) {
    if (estadoMedida) medidas[n] = estadoMedida;
  }
  if (Object.keys(medidas).length === 0) {
    mostrarAviso('#aviso-semaforo', 'Marca al menos una medida.', 'error');
    return;
  }
  try {
    estado.respuestas.semaforo = await api('/api/respuestas/semaforo', {
      method: 'POST',
      body: { medidas, prioridades: guardadasPrioridades(guardado.prioridades) }
    });
    mostrarAviso('#aviso-semaforo', 'Autodiagnóstico guardado. Podéis descargarlo.', 'ok');
    sessionStorage.setItem('t4_semaforo', JSON.stringify(estado.respuestas.semaforo));
  } catch (error) {
    mostrarAviso('#aviso-semaforo', error.message, 'error');
  }
}

function descargarAutodiagnostico() {
  const guardado = estado.respuestas.semaforo || { medidas: {}, prioridades: [] };
  if (Object.keys(guardado.medidas || {}).length === 0) {
    mostrarAviso('#aviso-semaforo', 'Marca al menos una medida antes de descargar.', 'error');
    return;
  }
  sessionStorage.setItem('t4_semaforo', JSON.stringify(guardado));
  // Los datos viajan en el fragmento (#), que nunca se envía al servidor ni
  // queda en los registros de acceso. Así la hoja imprimible funciona aunque
  // se abra en una pestaña nueva sin relación con esta.
  const datos = codificarBase64(JSON.stringify(guardado));
  const ventana = window.open(`/imprimir#d=${datos}`, '_blank');
  if (ventana) {
    // Se corta la relación con la ventana abierta sin arrastrar el
    // sessionStorage (que es justo lo que permite recuperar la respuesta).
    ventana.opener = null;
  }
}

async function guardarRetos() {
  const guardado = estado.respuestas.retos || { categorias: [], reto: '' };
  const reto = $('#campo-reto') ? $('#campo-reto').value : guardado.reto || '';
  if ((guardado.categorias || []).length === 0 && !reto.trim()) {
    mostrarAviso('#aviso-retos', 'Marca al menos una categoría o escribe un reto.', 'error');
    return;
  }
  try {
    estado.respuestas.retos = await api('/api/respuestas/retos', {
      method: 'POST',
      body: { categorias: guardado.categorias || [], reto }
    });
    mostrarAviso('#aviso-retos', '¡Gracias! Vuestros retos alimentan la agenda de la Red Solidaria para 2027.', 'ok');
  } catch (error) {
    mostrarAviso('#aviso-retos', error.message, 'error');
  }
}

async function enviarVotacion() {
  const ideas = $$('[data-idea][aria-pressed="true"]').map((c) => c.dataset.idea);
  if (ideas.length !== 2) {
    mostrarAviso('#aviso-voto', 'Elige exactamente dos ideas fuerza.', 'error');
    return;
  }
  try {
    await api('/api/respuestas/votacion', { method: 'POST', body: { ideas } });
    mostrarAviso('#aviso-voto', 'Voto registrado. Gracias.', 'ok');
    $$('[data-idea]').forEach((c) => c.setAttribute('aria-pressed', 'false'));
  } catch (error) {
    mostrarAviso('#aviso-voto', error.message, 'error');
  }
}

/* ------------------------------------------------------------------
   Arranque
   ------------------------------------------------------------------ */

async function cargarMesas() {
  try {
    const datos = await api('/api/mesas');
    estado.mesas = datos.mesas || [];
  } catch {
    estado.mesas = [];
  }
}

async function cargarIdeas() {
  try {
    const datos = await api('/api/ideas');
    estado.ideas = datos.ideas || [];
    estado.votacionAbierta = Boolean(datos.votacionAbierta);
  } catch {
    estado.ideas = [];
  }
}

async function recuperar() {
  try {
    const datos = await api('/api/estado');
    if (!datos.vacia) {
      estado.respuestas = {
        termometro: datos.termometro || null,
        mesa: datos.mesa || null,
        semaforo: datos.semaforo || null,
        retos: datos.retos || null
      };
    }
  } catch {
    /* si no se puede recuperar, se empieza de cero */
  }
}

async function iniciar() {
  const codigo = codigoSesion();
  const chip = $('#codigo-sesion');
  chip.hidden = false;
  chip.textContent = `Sesión ${codigo}`;
  chip.title = 'Código de sesión. Anótalo si cambias de móvil: te permite recuperar tus respuestas.';

  try {
    estado.config = await api('/api/config');
  } catch (error) {
    $('#app').innerHTML = `<div class="tarjeta"><div class="mensaje mensaje-error">
      <h3>No se ha podido cargar la app</h3>
      <p>${escapar(error.message)}</p>
    </div></div>`;
    return;
  }

  document.title = `${estado.config.evento.titulo} · App del Taller 4`;
  $('#marca').textContent = `${estado.config.evento.red} · ${estado.config.evento.taller}`;
  $('#titulo-app').textContent = estado.config.evento.titulo;

  await recuperar();
  await Promise.all([cargarMesas(), cargarIdeas()]);

  estado.vista = vistaDeHash();
  render();
}

window.addEventListener('popstate', () => {
  estado.vista = vistaDeHash();
  render();
});

$('#btn-atras').addEventListener('click', () => {
  const indice = VISTAS.indexOf(estado.vista);
  irA(VISTAS[Math.max(1, indice - 1)]);
});

$('#btn-siguiente').addEventListener('click', () => {
  const indice = VISTAS.indexOf(estado.vista);
  irA(VISTAS[Math.min(VISTAS.length - 1, indice + 1)]);
});

iniciar();
