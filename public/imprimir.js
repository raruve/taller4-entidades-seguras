/* Hoja imprimible del autodiagnóstico «semáforo». */

const $ = (sel) => document.querySelector(sel);

function decodificarBase64(datos) {
  const binario = atob(datos);
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

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
  // 1) Datos en el fragmento de la URL (no se envían al servidor).
  let semaforo = null;
  const fragmento = location.hash.startsWith('#d=') ? location.hash.slice(3) : '';
  if (fragmento) {
    try {
      semaforo = JSON.parse(decodificarBase64(fragmento));
    } catch {
      semaforo = null;
    }
  }
  // 2) Copia de seguridad: la sesión del navegador.
  if (!semaforo) {
    try {
      semaforo = JSON.parse(sessionStorage.getItem('t4_semaforo') || 'null');
    } catch {
      semaforo = null;
    }
  }
  semaforo = semaforo || {};
  const medidas = semaforo.medidas || {};
  const prioridades = (semaforo.prioridades || []).map(Number);

  let config;
  try {
    config = await fetch('/api/config').then((r) => r.json());
  } catch {
    $('#hoja').innerHTML = '<p class="sin-datos">No se ha podido cargar la información del taller.</p>';
    return;
  }

  if (Object.keys(medidas).length === 0) {
    $('#hoja').innerHTML = `
      <div class="hoja-cabecera">
        <div>
          <div class="kicker">${escapar(config.evento.red)} · ${escapar(config.evento.taller)}</div>
          <h1>Autodiagnóstico «semáforo»</h1>
          <p class="nota">${escapar(config.evento.titulo)}</p>
        </div>
        <img src="/assets/pll-logo.svg" alt="Pérez-Llorca" />
      </div>
      <p class="sin-datos">Todavía no has guardado el autodiagnóstico.<br />Vuelve a la app, marca las medidas y pulsa «Guardar».</p>`;
    return;
  }

  const etiquetas = { verde: 'Lo tenemos', ambar: 'A medias', rojo: 'No lo tenemos' };

  const filas = config.semaforo
    .map((m) => {
      const estado = medidas[String(m.n)] || '';
      const puntos = ['verde', 'ambar', 'rojo']
        .map(
          (e) =>
            `<span class="marca-estado ${e}" data-e="${e}" data-n="${m.n}"></span>`
        )
        .join(' ');
      const elegida = prioridades.includes(m.n);
      return `<tr>
        <td style="width:2rem"><strong>${m.n}</strong></td>
        <td>${escapar(m.medida)}</td>
        <td style="width:16rem">${escapar(m.verdeSi)}</td>
        <td style="width:5.5rem;text-align:center">${puntos}</td>
        <td style="width:5rem;text-align:center">${elegida ? '★' : ''}</td>
      </tr>`;
    })
    .join('');

  const listaPrioridades = prioridades
    .map((n) => {
      const m = config.semaforo.find((x) => x.n === n);
      return m ? `<li><strong>${n}.</strong> ${escapar(m.medida)}</li>` : '';
    })
    .join('');

  $('#hoja').innerHTML = `
    <div class="hoja-cabecera">
      <div>
        <div class="kicker">${escapar(config.evento.red)} · ${escapar(config.evento.taller)}</div>
        <h1>Autodiagnóstico «semáforo»</h1>
        <p class="nota">${escapar(config.evento.titulo)} · ${escapar(config.evento.subtitulo)}</p>
      </div>
      <img src="/assets/pll-logo.svg" alt="Pérez-Llorca" />
    </div>

    <table class="tabla-impresion">
      <thead>
        <tr>
          <th>N.º</th><th>Medida</th><th>Verde si…</th><th>Situación</th><th>Prioridad</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>

    <h2 style="font-size:1.05rem">Nuestras tres prioridades</h2>
    <ol class="prioridades">${listaPrioridades || '<li>Sin prioridades elegidas.</li>'}</ol>

    <p class="nota" style="margin-top:1rem">
      Leyenda: <span class="marca-estado verde elegido"></span> lo tenemos ·
      <span class="marca-estado ambar elegido"></span> a medias o sin documentar ·
      <span class="marca-estado rojo elegido"></span> no lo tenemos · ★ elegida como prioridad
    </p>

    <div class="pie-impresion">
      <p><strong>Cómo usar esta hoja:</strong> no es un informe de cumplimiento, sino una foto rápida para ordenar lo que hay que hacer en los próximos meses. Repasadla con el equipo y salid con un plan de tres pasos.</p>
      <p>
        ${escapar(config.evento.entidadDinamiza)} · ${escapar(config.evento.secretaria)} ·
        ${escapar(config.evento.fechaTexto)}. Los datos de este autodiagnóstico se borran
        ${config.conservacion.dias} días después del taller y no se guardan en la app.
      </p>
      <p>Este documento contiene datos internos de la entidad: compártelo solo con tu equipo.</p>
    </div>

    <div class="acciones no-imprimir" style="margin-top:1.2rem">
      <button type="button" class="boton boton-primario" onclick="window.print()">Imprimir o guardar como PDF</button>
    </div>`;

  // Marca el círculo de la situación elegida.
  for (const [n, estado] of Object.entries(medidas)) {
    const elemento = document.querySelector(`.marca-estado[data-n="${n}"][data-e="${estado}"]`);
    if (elemento) elemento.classList.add('elegido');
  }
}

iniciar();
