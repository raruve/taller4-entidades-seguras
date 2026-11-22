/* Cartela imprimible A4 con el código QR de acceso a la app. */

const $ = (sel) => document.querySelector(sel);

function escapar(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

async function iniciar() {
  let config;
  try {
    config = await fetch('/api/config').then((r) => r.json());
  } catch {
    $('#cartela').innerHTML = '<p>No se ha podido cargar la información del taller.</p>';
    return;
  }

  let svg = '';
  try {
    const respuesta = await fetch('/api/qr.svg');
    if (respuesta.ok) svg = await respuesta.text();
  } catch {
    svg = '';
  }

  const agenda = config.agenda
    .slice(0, 4)
    .map((a) => `<li><strong>${a.min}′</strong> ${escapar(a.titulo)}</li>`)
    .join('');

  $('#cartela').innerHTML = `
    <div class="cartela-cabecera">
      <div class="kicker">${escapar(config.evento.red)} · ${escapar(config.evento.taller)}</div>
      <h1>${escapar(config.evento.titulo)}</h1>
      <p style="color:var(--texto-suave);font-size:12pt;margin:0">${escapar(config.evento.subtitulo)}</p>
    </div>

    <div class="cartela-cuerpo">
      <div class="cartela-qr">${svg}</div>
      <div>
        <h2 style="font-size:16pt;margin:0 0 3mm">Escanea y participa</h2>
        <p style="font-size:11pt;color:var(--texto-suave);margin:0 0 6mm">
          Abre la cámara del móvil y apunta al código. No hace falta registrarse ni dar
          ningún dato personal.
        </p>
        <ul class="pasos-cartela">${agenda}</ul>
        <p style="font-size:9.5pt;color:var(--texto-suave);margin:0">
          Tus respuestas se guardan con un seudónimo, se borran a los
          ${config.conservacion.dias} días y los resultados se comparten con la Red Solidaria
          de forma agregada y anónima.
        </p>
      </div>
    </div>

    <div class="cartela-pie">
      <div>
        <strong style="color:var(--azul)">${escapar(config.evento.entidadDinamiza)}</strong> ·
        ${escapar(config.evento.secretaria)}, secretaría técnica<br />
        ${escapar(config.evento.fechaTexto)}${config.evento.lugarTexto ? ` · ${escapar(config.evento.lugarTexto)}` : ''}
      </div>
      <img src="/assets/pll-logo.svg" alt="Pérez-Llorca" />
    </div>`;
}

iniciar();
