/* ------------------------------------------------------------------
   Panel del ponente
   ------------------------------------------------------------------
   Vista de resultados en directo para proyectar en la sala durante el
   taller. Recibe únicamente datos agregados: el texto libre de los
   participantes no sale de la app hasta que se revisa en el panel de
   dinamización.
   ------------------------------------------------------------------ */

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

const REFRESCO_MS = 5000;

const estado = {
  token: null,
  datos: null,
  temporizador: null
};

function escapar(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

/* ------------------------------------------------------------------
   Acceso
   ------------------------------------------------------------------ */

/**
 * El token puede venir en el fragmento de la URL (#t=...) cuando se abre
 * el panel desde el panel de dinamización. El fragmento no viaja al
 * servidor, así que el token no queda en ningún registro de acceso.
 */
function tokenDelFragmento() {
  const hash = location.hash || '';
  const coincidencia = hash.match(/[#&]t=([^&]+)/);
  if (!coincidencia) return null;
  history.replaceState(null, '', location.pathname);
  return decodeURIComponent(coincidencia[1]);
}

function mostrarAcceso(mensaje = '') {
  $('#acceso').hidden = false;
  $('#panel').hidden = true;
  $('#aviso-acceso').innerHTML = mensaje ? `<div class="mensaje mensaje-error">${escapar(mensaje)}</div>` : '';
  $('#password').focus();
}

function mostrarPanel() {
  $('#acceso').hidden = true;
  $('#panel').hidden = false;
}

async function entrar(evento) {
  evento.preventDefault();
  const password = $('#password').value;
  try {
    const respuesta = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const datos = await respuesta.json();
    if (!respuesta.ok) throw new Error(datos.error || 'No se ha podido entrar.');
    estado.token = datos.token;
    sessionStorage.setItem('t4_admin', datos.token);
    $('#aviso-acceso').innerHTML = '';
    await cargar();
    mostrarPanel();
    arrancarRefresco();
  } catch (error) {
    mostrarAcceso(error.message);
  }
}

/* ------------------------------------------------------------------
   Datos
   ------------------------------------------------------------------ */

async function api(ruta) {
  const respuesta = await fetch(ruta, {
    headers: { 'X-Admin-Token': estado.token },
    cache: 'no-store'
  });
  if (respuesta.status === 401) {
    estado.token = null;
    sessionStorage.removeItem('t4_admin');
    mostrarAcceso('La sesión ha caducado. Vuelve a introducir la contraseña.');
    throw new Error('Sesión no válida');
  }
  if (!respuesta.ok) throw new Error('No se han podido leer los resultados.');
  return respuesta.json();
}

async function cargar() {
  try {
    estado.datos = await api('/api/admin/panel');
    pintar();
  } catch (error) {
    if (estado.token) {
      $('#contenido').innerHTML = `<p class="bloque-panel ancho"><span class="vacio">${escapar(error.message)}</span></p>`;
    }
  }
}

function arrancarRefresco() {
  if (estado.temporizador) clearInterval(estado.temporizador);
  estado.temporizador = setInterval(cargar, REFRESCO_MS);
}

/* ------------------------------------------------------------------
   Presentación
   ------------------------------------------------------------------ */

function barra(etiqueta, valor, maximo) {
  const porcentaje = maximo > 0 ? Math.round((valor / maximo) * 100) : 0;
  return `<div class="barra-panel">
    <div class="cabeza"><span>${escapar(etiqueta)}</span><span class="valor">${valor}</span></div>
    <div class="pista"><i style="width:${porcentaje}%"></i></div>
  </div>`;
}

function bloqueVacio(titulo, sub) {
  return `<section class="bloque-panel">
    <h2>${escapar(titulo)}</h2>
    ${sub ? `<p class="sub">${escapar(sub)}</p>` : ''}
    <p class="vacio">Todavía no hay respuestas.</p>
  </section>`;
}

function pintarTermometro(datos) {
  const termometro = datos.termometro || {};
  const incidentes = datos.incidentes || {};
  const pautas = datos.pautas || {};
  const personas = datos.terminadosTermometro || 0;

  const maximo = Math.max(
    1,
    ...Object.values(termometro),
    ...Object.values(incidentes),
    ...Object.values(pautas)
  );

  const parte = (titulo, datosParte) => {
    const claves = Object.entries(datosParte).sort((a, b) => b[1] - a[1]);
    if (!claves.length) return '';
    return `<h3 class="sub" style="margin-top:.7rem">${escapar(titulo)}</h3>` +
      claves.map(([k, v]) => barra(k, v, maximo)).join('');
  };

  return `<section class="bloque-panel">
    <h2>Termómetro digital</h2>
    <p class="sub">${personas} ${personas === 1 ? 'persona ha contestado' : 'personas han contestado'}</p>
    ${parte('Uso de IA', termometro)}
    ${parte('Incidentes en los dos últimos años', incidentes)}
    ${parte('Pautas internas', pautas)}
  </section>`;
}

function pintarSemaforo(datos) {
  const medidas = datos.medidas || [];
  const semaforo = datos.semaforo || {};
  const prioridades = datos.prioridades || {};

  const filas = medidas
    .map((m) => {
      const cuenta = semaforo[String(m.n)] || { verde: 0, ambar: 0, rojo: 0 };
      const maximo = Math.max(cuenta.verde, cuenta.ambar, cuenta.rojo);
      const empatadas = ['verde', 'ambar', 'rojo'].filter((e) => (cuenta[e] || 0) === maximo && maximo > 0);
      const hayEmpate = empatadas.length > 1;
      const pildoras = ['verde', 'ambar', 'rojo']
        .map((estado) => {
          const valor = cuenta[estado] || 0;
          let clase = '';
          if (valor > 0 && valor === maximo) clase = hayEmpate ? 'empate' : `principal ${estado}`;
          return `<span class="pildora ${estado} ${clase}">
            <span class="punto"></span>${valor}
          </span>`;
        })
        .join('');
      const estrellas = prioridades[String(m.n)] || 0;
      return `<div class="medida-panel">
        <span class="num">${m.n}</span>
        <span class="texto">${escapar(m.medida)}${estrellas ? ` <span class="prioridad">★ ${estrellas}</span>` : ''}</span>
        <span class="pildoras">${pildoras}</span>
      </div>`;
    })
    .join('');

  return `<section class="bloque-panel ancho">
    <h2>Semáforo · las 10 medidas</h2>
    <p class="sub">Verde: lo tenemos · Ámbar: a medias · Rojo: no lo tenemos · ★ elegida como prioridad</p>
    <div class="semaforo-panel">${filas}</div>
  </section>`;
}

function pintarCasos(datos) {
  const casos = datos.casos || {};
  const tarjetas = Object.entries(casos)
    .map(([id, caso]) => {
      const mesas = Object.entries(caso.mesas || {})
        .map(([alias, n]) => `${escapar(alias)}: ${n}`)
        .join(' · ');
      return `<div class="caso-panel">
        <div class="titulo">Caso ${escapar(id)}. ${escapar(caso.titulo)}</div>
        <div class="num">${caso.respuestas}</div>
        <div class="detalle">${mesas ? `${mesas} respuestas` : 'Sin respuestas todavía'}</div>
      </div>`;
    })
    .join('');

  return `<section class="bloque-panel">
    <h2>Casos en mesas</h2>
    <p class="sub">Respuestas por caso</p>
    <div class="casos-panel">${tarjetas}</div>
  </section>`;
}

function pintarRetos(datos) {
  const retos = datos.retos || {};
  const claves = Object.entries(retos).sort((a, b) => b[1] - a[1]);
  if (!claves.length) return bloqueVacio('Retos por categoría', 'Qué necesitan las entidades');
  const maximo = Math.max(1, ...claves.map(([, v]) => v));
  return `<section class="bloque-panel">
    <h2>Retos por categoría</h2>
    <p class="sub">Áreas donde se pide más apoyo</p>
    ${claves.map(([k, v]) => barra(k, v, maximo)).join('')}
  </section>`;
}

function pintarIdeas(datos) {
  const ideas = (datos.ideas || []).slice().sort((a, b) => b.votos - a.votos).slice(0, 6);
  if (!ideas.length) {
    return bloqueVacio('Ideas fuerza', datos.votacionAbierta ? 'Votación abierta' : 'La votación aún no se ha abierto');
  }
  return `<section class="bloque-panel">
    <h2>Ideas fuerza</h2>
    <p class="sub">${datos.votacionAbierta ? 'Votación abierta' : 'Propuestas cargadas'}</p>
    ${ideas
      .map(
        (i) => `<div class="idea-panel">
          <span>${escapar(i.texto)}</span>
          <span class="votos">${i.votos} ${i.votos === 1 ? 'voto' : 'votos'}</span>
        </div>`
      )
      .join('')}
  </section>`;
}

function pintar() {
  const datos = estado.datos;
  if (!datos) return;

  $('#participantes').textContent = datos.participantes;
  $('#ultima-lectura').textContent = `Última lectura: ${new Date(datos.generado).toLocaleTimeString('es-ES')}`;
  $('#panel-conservacion').textContent = `Datos brutos: borrado automático el ${datos.conservacion.fechaBorrado}`;

  $('#contenido').innerHTML = [
    pintarSemaforo(datos),
    pintarTermometro(datos),
    pintarCasos(datos),
    pintarRetos(datos),
    pintarIdeas(datos)
  ].join('');
}

/* ------------------------------------------------------------------
   Arranque
   ------------------------------------------------------------------ */

async function iniciar() {
  $('#form-acceso').addEventListener('submit', entrar);

  $('#btn-pantalla').addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && estado.token) cargar();
  });

  const delFragmento = tokenDelFragmento();
  if (delFragmento) {
    estado.token = delFragmento;
    sessionStorage.setItem('t4_admin', delFragmento);
  } else {
    estado.token = sessionStorage.getItem('t4_admin');
  }

  if (!estado.token) {
    mostrarAcceso();
    return;
  }

  try {
    await cargar();
    if (estado.token) {
      mostrarPanel();
      arrancarRefresco();
    }
  } catch (error) {
    mostrarAcceso();
  }
}

iniciar();
