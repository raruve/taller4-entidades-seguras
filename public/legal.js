/* Página de información sobre el tratamiento de datos (art. 13 RGPD). */

const escapar = (t) =>
  String(t ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);

async function iniciar() {
  const pagina = document.getElementById('pagina');
  let config;
  try {
    config = await fetch('/api/config').then((r) => r.json());
  } catch {
    pagina.innerHTML = '<p class="nota">No se ha podido cargar la información legal.</p>';
    return;
  }

  pagina.innerHTML = `
    <div class="kicker">${escapar(config.evento.red)} · ${escapar(config.evento.taller)}</div>
    <h2>Información sobre el tratamiento de datos</h2>
    <p class="nota">${escapar(config.evento.titulo)} · App de participantes</p>

    <div class="caja-info">${escapar(config.infoLegalCorta)}</div>

    ${config.infoLegalLarga
      .map((bloque) => `<h3>${escapar(bloque.titulo)}</h3><p>${escapar(bloque.texto)}</p>`)
      .join('')}

    <h3>Datos del responsable y contacto</h3>
    <p>
      Puedes ejercer tus derechos de acceso, rectificación, supresión, limitación y oposición
      (arts. 15 a 22 del RGPD) escribiendo al correo indicado arriba. Si consideras que no
      se han atendido correctamente, puedes reclamar ante la Agencia Española de Protección
      de Datos (www.aepd.es).
    </p>

    <h3>Cambios en esta información</h3>
    <p>
      Este texto forma parte del diseño de la app y se revisa antes de cada taller. Cualquier
      cambio substantial se comunicará a las personas participantes en la sesión.
    </p>

    <p style="margin-top:2rem"><a href="/">← Volver a la app</a></p>`;
}

iniciar();
