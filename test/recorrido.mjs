/**
 * Recorrido completo de la app con un navegador real (Chromium).
 * Comprueba las pantallas, las validaciones y el flujo de guardado, y deja
 * capturas en /workspace/capturas.
 *
 *   node test/recorrido.mjs [http://localhost:3210]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:3210';
const DIR = '/workspace/capturas';
fs.mkdirSync(DIR, { recursive: true });

const MOVIL = { width: 390, height: 844 };
const errores = [];
let n = 0;

async function captura(page, nombre) {
  n++;
  const fichero = `${DIR}/${String(n).padStart(2, '0')}-${nombre}.png`;
  await page.screenshot({ path: fichero, fullPage: true });
  console.log(`  📸 ${fichero}`);
}

async function esperarHash(page, hash, timeout = 6000) {
  const limite = Date.now() + timeout;
  while (Date.now() < limite) {
    if (page.url().includes(hash)) return true;
    await page.waitForTimeout(150);
  }
  throw new Error(`No se ha llegado a la vista ${hash}`);
}

/** Espera a que un selector llegue al número mínimo de elementos. */
async function esperarConteo(page, selector, minimo, timeout = 12000) {
  const limite = Date.now() + timeout;
  while (Date.now() < limite) {
    if ((await page.locator(selector).count()) >= minimo) return true;
    await page.waitForTimeout(200);
  }
  return false;
}

function comprobar(condicion, mensaje) {
  if (!condicion) {
    errores.push(mensaje);
    console.error(`  ✗ ${mensaje}`);
  } else {
    console.log(`  ✓ ${mensaje}`);
  }
}

const EXECUTABLE =
  process.env.CHROMIUM_PATH || '/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome';
const navegador = await chromium.launch({
  executablePath: EXECUTABLE,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});
const contexto = await navegador.newContext({
  viewport: MOVIL,
  deviceScaleFactor: 2,
  locale: 'es-ES',
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
});
const page = await contexto.newPage();

const peticionesExternas = [];
page.on('request', (req) => {
  const url = req.url();
  if (!url.startsWith(BASE) && !url.startsWith('data:')) peticionesExternas.push(url);
});

page.on('pageerror', (e) => errores.push(`Error de JavaScript: ${e.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errores.push(`Consola: ${msg.text()}`);
});

/* ---------------------------------------------------------------- */

console.log('\n▸ Pantalla de inicio');
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForSelector('.portada');
comprobar((await page.title()).includes('Entidades seguras'), 'El título de la pestaña es correcto');
comprobar(await page.locator('.titulo-grande').isVisible(), 'Se muestra el título del taller');
comprobar(await page.locator('#codigo-sesion').isVisible(), 'Se muestra el código de sesión');
comprobar((await page.locator('.agenda li').count()) === 6, 'La agenda muestra los 6 momentos');
comprobar(
  (await page.locator('.agenda-enlace[data-ir]').count()) === 4,
  'Solo los 4 momentos con contenido en la app son navegables'
);
comprobar(
  (await page.locator('.agenda-sin-boton').count()) === 2,
  '«Lo esencial» y «Puesta en común» no tienen botón activable'
);
const sinBoton = await page.locator('.agenda-sin-boton strong').allInnerTexts();
comprobar(
  sinBoton.join('|') === 'Lo esencial|Puesta en común',
  `Los dos momentos sin botón son los correctos (${sinBoton.join(', ')})`
);
comprobar((await page.locator('.organiza').count()) === 0, 'Ya no aparece el bloque de marca en cabecera');
comprobar((await page.locator('.pie div').count()) === 0, 'El pie solo conserva el logo');
await page.waitForSelector('.acceso-qr img', { timeout: 8000 });
comprobar(await page.locator('.acceso-qr img').isVisible(), 'Se muestra el código QR de acceso');
comprobar(
  (await page.locator('.acceso-qr img').getAttribute('src')) === '/api/qr.svg',
  'El QR de inicio lo sirve la propia app'
);
await captura(page, 'inicio');

console.log('\n▸ Saltar a cada sección desde el inicio');
const SALTOS = [
  { indice: 0, esperado: 'termometro', nombre: 'Termómetro digital' },
  { indice: 1, esperado: 'mesas', nombre: 'Casos en mesas' },
  { indice: 2, esperado: 'semaforo', nombre: 'Semáforo' },
  { indice: 3, esperado: 'retos', nombre: 'Retos e ideas fuerza' }
];
for (const salto of SALTOS) {
  await page.goto(`${BASE}/#/inicio`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.agenda-enlace');
  const enlace = page.locator('.agenda-enlace[data-ir]').nth(salto.indice);
  const destino = await enlace.getAttribute('data-ir');
  if (destino !== salto.esperado) {
    comprobar(false, `«${salto.nombre}» lleva a «${salto.esperado}» (lleva a «${destino}»)`);
    continue;
  }
  await enlace.click();
  await esperarHash(page, salto.esperado);
  comprobar(true, `«${salto.nombre}» salta a «${salto.esperado}»`);
}

console.log('\n▸ Volver al inicio desde cualquier pantalla');
await page.goto(`${BASE}/#/inicio`, { waitUntil: 'networkidle' });
await page.waitForSelector('.portada');
comprobar(
  await page.locator('#btn-inicio').isHidden(),
  'En la portada no se muestra el botón de inicio'
);
await page.locator('.agenda-enlace[data-ir="semaforo"]').click();
await esperarHash(page, 'semaforo');
comprobar(
  await page.locator('#btn-inicio').isVisible(),
  'Al saltar a otra pantalla aparece el botón de inicio'
);
await captura(page, 'semaforo-con-boton-inicio');
await page.click('#btn-inicio');
await esperarHash(page, 'inicio');
comprobar(
  await page.locator('.portada').isVisible(),
  'El botón de inicio devuelve a la portada'
);
comprobar(
  await page.locator('#btn-inicio').isHidden(),
  'Al volver a la portada, el botón de inicio se oculta'
);

console.log('\n▸ Información legal (art. 13)');
await page.goto(`${BASE}/#/inicio`, { waitUntil: 'networkidle' });
await page.waitForSelector('.portada');
comprobar(
  (await page.locator('.portada details.legal-detall').count()) === 0,
  'La pantalla de inicio ya no tiene el apartado desplegable'
);
comprobar(
  (await page.locator('.legal-enlace a[href="/legal"]').count()) === 1,
  'La pantalla de inicio enlaza con la información legal completa'
);
await captura(page, 'inicio');

console.log('\n▸ Termómetro digital');
await page.click('[data-ir="termometro"]');
await page.waitForSelector('#form-termometro');
comprobar((await page.locator('.pregunta').count()) === 3, 'Hay tres preguntas');

// Validación: no se puede enviar sin responder.
await page.click('#form-termometro button[type="submit"]');
comprobar(
  await page.locator('#aviso-termometro .mensaje-error').isVisible(),
  'Avisa si faltan preguntas por responder'
);

await page.click('input[name="q_ia"][value="Sí, cada uno las suyas"]');
await page.click('input[name="q_incidentes"][value="Phishing o suplantación"]');
await page.click('input[name="q_incidentes"][value="Fraude en pagos"]');
await page.click('input[name="q_pautas"][value="Informales"]');
await captura(page, 'termometro');
await page.click('#form-termometro button[type="submit"]');
await page.waitForSelector('#aviso-termometro .mensaje-ok', { timeout: 5000 });
comprobar(true, 'El termómetro se guarda correctamente');
await esperarHash(page, 'mesas');
comprobar(true, 'Pasa automáticamente a los casos');

console.log('\n▸ Mesas y casos');
await page.waitForSelector('[data-mesa]');
comprobar((await page.locator('[data-mesa]').count()) >= 4, 'Se listan las mesas abiertas');
await page.click('[data-mesa="Mesa 1"]');
await page.waitForSelector('#form-mesa');
comprobar(true, 'La mesa abre el caso asignado');
comprobar(
  (await page.locator('.tarjeta .kicker:has-text("Caso 1")').count()) > 0,
  'Se muestra el escenario del caso 1'
);
comprobar(await page.locator('.caja-aviso').first().isVisible(), 'Se muestra el aviso de no escribir datos reales');

console.log('\n▸ Detector de datos personales');
await page.fill('[data-campo="riesgo"]', 'Podéis preguntar a maria.garcia@ejemplo.org o al 612 345 678');
await page.waitForTimeout(200);
comprobar(
  await page.locator('[data-alerta="riesgo"]').isVisible(),
  'Avisa cuando el texto parece contener datos personales'
);
await captura(page, 'caso-datos-personales');

await page.fill('[data-campo="riesgo"]', 'El riesgo es que el informe acabe en un servidor fuera de la UE.');
await page.fill('[data-campo="hacer"]', 'Solo herramientas corporativas con contrato de encargado y sin entrenamiento.');
await page.fill('[data-campo="necesidad"]', 'Una pauta escrita y una persona responsable de revisarla.');
await page.waitForTimeout(200);
comprobar(
  await page.locator('[data-alerta="riesgo"]').isHidden(),
  'La alerta desaparece cuando el texto es limpio'
);

// Sin marcar la casilla de revisión no deja enviar.
await page.click('#form-mesa button[type="submit"]');
comprobar(
  await page.locator('#aviso-mesa .mensaje-error').isVisible(),
  'Exige confirmar la revisión antes de enviar'
);

await page.click('#check-mesa');
await captura(page, 'caso-relleno');
await page.click('#form-mesa button[type="submit"]');
await page.waitForSelector('.mensaje-clave', { timeout: 5000 });
comprobar(true, 'Las respuestas de la mesa se guardan');
comprobar(
  (await page.locator('.mensaje-clave').innerText()).includes('Herramienta gratuita'),
  'Muestra el mensaje clave del caso'
);
await captura(page, 'caso-guardado');

console.log('\n▸ Semáforo');
await page.click('#btn-siguiente');
await page.waitForSelector('.medida');
comprobar((await page.locator('.medida').count()) === 10, 'Hay diez medidas');

// El punto de «verde» tiene que ser verde, no el azul de marca.
const colorVerde = await page
  .locator('.semaforo-boton[data-estado="verde"] .punto')
  .first()
  .evaluate((e) => getComputedStyle(e).backgroundColor);
comprobar(
  colorVerde === 'rgb(30, 122, 80)',
  `El punto de «verde» es verde y no azul (${colorVerde})`
);
const colorAmbar = await page
  .locator('.semaforo-boton[data-estado="ambar"] .punto')
  .first()
  .evaluate((e) => getComputedStyle(e).backgroundColor);
const colorRojo = await page
  .locator('.semaforo-boton[data-estado="rojo"] .punto')
  .first()
  .evaluate((e) => getComputedStyle(e).backgroundColor);
comprobar(
  new Set([colorVerde, colorAmbar, colorRojo]).size === 3,
  'Los tres colores del semáforo se distinguen entre sí'
);

// Las medidas 5 y 9 están reformuladas: el código de colores tiene que
// permitir distinguir niveles de riesgo.
const textoMedida = async (n) =>
  (await page.locator(`.medida:nth-of-type(${n}) .medida-texto`).innerText()).trim();
const texto5 = await textoMedida(5);
const texto9 = await textoMedida(9);
comprobar(
  texto5.includes('contrato de encargado') && texto5.includes('conocemos'),
  'La medida 5 se formula en términos de riesgo'
);
comprobar(
  texto9.includes('protocolo de actuación definido'),
  'La medida 9 pregunta por el protocolo de actuación'
);
comprobar(
  !texto9.includes('(') && !texto9.includes(')'),
  'La medida 9 no conserva los ejemplos entre paréntesis'
);

await page.click('.medida:nth-of-type(1) .semaforo-boton[data-estado="verde"]');
await page.click('.medida:nth-of-type(2) .semaforo-boton[data-estado="ambar"]');
await page.click('.medida:nth-of-type(3) .semaforo-boton[data-estado="rojo"]');
comprobar(
  (await page.locator('.semaforo-boton[aria-pressed="true"]').count()) === 3,
  'Se registran las marcas del semáforo'
);

// Tres prioridades como máximo.
await page.click('input[data-prioridad="2"]');
await page.click('input[data-prioridad="3"]');
await page.click('input[data-prioridad="5"]');
comprobar(
  (await page.locator('input[data-prioridad]:checked').count()) === 3,
  'Se pueden elegir tres prioridades'
);
await page.click('input[data-prioridad="7"]');
await page.waitForTimeout(200);
comprobar(
  (await page.locator('input[data-prioridad]:checked').count()) === 3,
  'No permite una cuarta prioridad'
);
comprobar(
  await page.locator('#aviso-semaforo .mensaje-error').isVisible(),
  'Avisa del límite de tres prioridades'
);
await captura(page, 'semaforo');
await page.click('#btn-guardar-semaforo');
await page.waitForSelector('#aviso-semaforo .mensaje-ok', { timeout: 5000 });
comprobar(true, 'El autodiagnóstico se guarda');

console.log('\n▸ Hoja imprimible del autodiagnóstico');
const [hoja] = await Promise.all([
  page.waitForEvent('popup'),
  page.click('#btn-descargar')
]);
await hoja.waitForLoadState('domcontentloaded');
await hoja.waitForSelector('.tabla-impresion', { timeout: 10000 });
comprobar((await hoja.locator('.tabla-impresion tbody tr').count()) === 10, 'La hoja lista las diez medidas');
comprobar((await hoja.locator('.marca-estado.verde').count()) > 0, 'Marca la situación elegida');
await hoja.screenshot({ path: `${DIR}/autodiagnostico-imprimible.png`, fullPage: true });
console.log(`  📸 ${DIR}/autodiagnostico-imprimible.png`);
await hoja.close();

console.log('\n▸ Panel de dinamización · preparación de la votación');
const admin = await contexto.newPage();
await admin.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
await admin.waitForSelector('#form-login');
await captura(admin, 'admin-acceso');
await admin.fill('#password', 'incorrecta');
await admin.click('#form-login button[type="submit"]');
await admin.waitForSelector('#aviso-login .mensaje-error');
comprobar(true, 'El panel rechaza una contraseña incorrecta');
// La contraseña del panel: por defecto la de las pruebas locales, pero se
// puede apuntar a un despliegue real con ADMIN_PASSWORD.
const PASSWORD_ADMIN = process.env.ADMIN_PASSWORD || 'pruebas123';
await admin.fill('#password', PASSWORD_ADMIN);
await admin.click('#form-login button[type="submit"]');
await admin.waitForSelector('.cifras', { timeout: 8000 });
comprobar(true, 'El panel entra con la contraseña correcta');
comprobar((await admin.locator('.cifra').count()) === 4, 'Muestra las cifras en directo');
await captura(admin, 'admin-resultados');

console.log('\n▸ Panel del ponente (vista para proyectar)');
const panel = await contexto.newPage();
await panel.goto(`${BASE}/panel`, { waitUntil: 'networkidle' });
await panel.waitForSelector('#form-acceso');
comprobar(true, 'El panel del ponente pide la contraseña');
await panel.fill('#password', 'incorrecta');
await panel.click('#form-acceso button[type="submit"]');
await panel.waitForSelector('#aviso-acceso .mensaje-error');
comprobar(true, 'El panel del ponente rechaza una contraseña incorrecta');
await panel.fill('#password', PASSWORD_ADMIN);
await panel.click('#form-acceso button[type="submit"]');
await panel.waitForSelector('.bloque-panel', { timeout: 10000 });
comprobar((await panel.locator('.bloque-panel').count()) >= 5, 'El panel del ponente muestra los bloques de resultados');
comprobar((await panel.locator('.medida-panel').count()) === 10, 'El semáforo muestra las diez medidas');
comprobar(
  (await panel.locator('.medida-panel .pildora.verde').count()) === 10,
  'Cada medida muestra el color de las tres respuestas'
);
comprobar(
  (await panel.locator('#participantes').innerText()).trim() !== '0',
  'El panel indica cuántas personas han respondido'
);
comprobar(
  (await panel.locator('.caso-panel').count()) === 4,
  'El panel muestra los cuatro casos con sus respuestas'
);
// El QR de acceso se proyecta en la esquina para que quien llega tarde pueda
// entrar con el móvil.
comprobar(await panel.locator('#qr-sala img').isVisible(), 'El panel del ponente muestra el QR de acceso');
comprobar(
  (await panel.locator('#qr-sala img').getAttribute('src')) === '/api/qr.svg',
  'El QR del panel lo sirve la propia app'
);
const esquina = await panel.locator('#qr-sala').boundingBox();
const tamano = await page.viewportSize();
comprobar(
  esquina.x + esquina.width >= tamano.width - 40 && esquina.y + esquina.height >= tamano.height - 40,
  'El QR del panel está en la esquina inferior derecha'
);
await panel.locator('#qr-sala').click();
await panel.waitForTimeout(300);
comprobar(
  await panel.locator('#qr-sala').isVisible(),
  'El QR del panel se puede ocultar y volver a mostrar'
);
await panel.locator('#qr-sala').click();
await panel.waitForTimeout(300);
comprobar(
  await panel.locator('#qr-sala img').isVisible(),
  'El QR del panel vuelve a mostrarse tras ocultarlo'
);
// Lo que se proyecta en la sala no puede incluir el texto libre de los
// participantes: ese texto se revisa antes de compartirlo.
const textoProyectado = await panel.locator('#contenido').innerText();
comprobar(
  !textoProyectado.includes('El riesgo es que el informe acabe') &&
    !textoProyectado.includes('Necesitamos formación práctica en IA'),
  'El panel del ponente no muestra el texto libre de los participantes'
);
await captura(panel, 'panel-ponente');

// En un móvil el panel no debe desbordarse: se proyecta desde un portátil,
// pero se puede consultar desde el teléfono.
await panel.setViewportSize({ width: 360, height: 780 });
await panel.waitForTimeout(400);
comprobar(
  await panel.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
  'El panel del ponente no se desborda en un móvil'
);

// El botón del panel de dinamización abre el panel del ponente en otra
// pestaña, ya con la sesión iniciada.
const [panelDesdeAdmin] = await Promise.all([
  contexto.waitForEvent('page'),
  admin.click('#btn-abrir-panel')
]);
await panelDesdeAdmin.waitForSelector('.bloque-panel', { timeout: 10000 });
comprobar(true, 'El botón del panel de dinamización abre el panel del ponente');
comprobar(
  (await panelDesdeAdmin.locator('#form-acceso').isVisible()) === false,
  'El panel abierto desde el botón no pide la contraseña otra vez'
);
await panelDesdeAdmin.close();
await panel.close();

console.log('\n▸ Guion «Lo esencial en 15 minutos» y puntos a verificar');
await admin.click('[data-pestana="guion"]');
await admin.waitForSelector('.bloque-guion', { timeout: 8000 });
comprobar(
  (await admin.locator('.bloque-guion').count()) === 4,
  'El guion tiene los cuatro bloques (A-D)'
);
const letras = await admin.locator('.bloque-letra').allInnerTexts();
comprobar(
  letras.join('') === 'ABCD',
  'Los bloques del guion están en orden (A, B, C y D)'
);
comprobar(
  (await admin.locator('.bloque-mensaje').count()) === 4,
  'Cada bloque lleva su mensaje para la diapositiva'
);
comprobar(
  (await admin.locator('.nota-ponente').count()) === 4,
  'Cada bloque guarda la nota del ponente con la base normativa'
);
comprobar(
  (await admin.locator('.ia-fila').count()) === 3,
  'El bloque de IA incluye el semáforo verde/ámbar/rojo'
);
const notaOculta = await admin.locator('.nota-ponente p').first().isVisible();
comprobar(!notaOculta, 'La nota del ponente no se proyecta hasta abrirla');
await admin.click('.nota-ponente summary');
await admin.locator('.nota-ponente p').first().waitFor({ state: 'visible', timeout: 6000 });
comprobar(
  await admin.locator('.nota-ponente p').first().isVisible(),
  'La nota del ponente se abre al pulsar'
);

// El repintado del panel (cada 15 s o al cambiar de pestaña) no debe cerrar
// la nota que el ponente tiene abierta.
await admin.click('[data-pestana="ideas"]');
await admin.waitForTimeout(800);
await admin.click('[data-pestana="guion"]');
await admin.waitForTimeout(1500);
comprobar(
  await admin.locator('.nota-ponente p').first().isVisible(),
  'La nota del ponente sigue abierta tras cambiar de pestaña'
);
await captura(admin, 'admin-guion');
await admin.click('.nota-ponente summary');
await admin.waitForTimeout(250);
await captura(admin, 'admin-guion-nota');
await admin.click('.nota-ponente summary');

await admin.click('[data-pestana="checklist"]');
await admin.waitForSelector('.check-verificacion', { timeout: 8000 });
comprobar(
  (await admin.locator('.check-verificacion').count()) >= 4,
  'La lista de puntos a verificar está completa'
);
comprobar(
  (await admin.locator('.lista-simple li').count()) >= 7,
  'Muestra los objetivos y los resultados esperados'
);
await admin.click('.check-verificacion input');
await admin.waitForTimeout(250);
comprobar(
  await admin.locator('.check-verificacion input').first().isChecked(),
  'Se puede marcar un punto como verificado'
);
await captura(admin, 'admin-checklist');

console.log('\n▸ Copia de seguridad y aviso de reinicio');
await admin.click('[data-pestana="descargas"]');
await admin.waitForSelector('#btn-copia-descargar', { timeout: 8000 });
comprobar(
  await admin.locator('#btn-copia-descargar').isVisible(),
  'El panel ofrece descargar una copia de seguridad'
);
comprobar(
  await admin.locator('#btn-copia-restaurar').isVisible(),
  'El panel ofrece restaurar una copia'
);

// La copia se pide con el token del panel, como haría el navegador.
const TOKEN_ADMIN = await admin.evaluate(() => sessionStorage.getItem('t4_admin'));
const copia = await admin.evaluate(async (token) => {
  const r = await fetch('/api/admin/copia', { headers: { 'X-Admin-Token': token } });
  return { ok: r.ok, cuerpo: await r.json() };
}, TOKEN_ADMIN);
comprobar(copia.ok, 'La copia de seguridad se descarga con el token del panel');
comprobar(
  copia.cuerpo.formato === 'taller4-copia' && Boolean(copia.cuerpo.respuestas),
  'La copia contiene el estado completo de la sesión'
);
comprobar(
  Boolean(copia.cuerpo.arranque && copia.cuerpo.arranque.id),
  'La copia incluye la marca de arranque del servicio'
);

const restauracionInvalida = await admin.evaluate(async (token) => {
  const r = await fetch('/api/admin/copia', {
    method: 'POST',
    headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ formato: 'otra-cosa' })
  });
  return r.status;
}, TOKEN_ADMIN);
comprobar(
  restauracionInvalida === 400,
  'Una copia inválida se rechaza sin tocar los datos'
);

const arranqueEnResumen = await admin.evaluate(async (token) => {
  const r = await fetch('/api/admin/resumen', { headers: { 'X-Admin-Token': token } });
  return (await r.json()).arranque;
}, TOKEN_ADMIN);
comprobar(
  Boolean(arranqueEnResumen && arranqueEnResumen.id),
  'El resumen expone la marca de arranque para detectar reinicios'
);

comprobar(
  await admin.locator('#refresco-auto').isChecked(),
  'El refresco automático viene activado (mantiene el servicio despierto)'
);

console.log('\n▸ Preparar las ideas fuerza para la votación');
await admin.click('[data-pestana="ideas"]');
await admin.waitForSelector('#nueva-idea');
await admin.fill('#nueva-idea', 'Formación práctica en IA para equipos y voluntariado');
await admin.click('#btn-nueva-idea');
await admin.waitForTimeout(900);
await admin.fill('#nueva-idea', 'Asesoría jurídica accesible para entidades pequeñas');
await admin.click('#btn-nueva-idea');
await admin.waitForTimeout(900);
const antes = await admin.locator('#btn-votacion').innerText();
await admin.click('#btn-votacion');
await admin.waitForTimeout(900);
const despues = await admin.locator('#btn-votacion').innerText();
comprobar(antes !== despues, 'El dinamizador puede abrir y cerrar la votación');
if (!despues.includes('Cerrar')) {
  await admin.click('#btn-votacion');
  await admin.waitForTimeout(900);
}
comprobar(
  (await admin.locator('#btn-votacion').innerText()).includes('Cerrar'),
  'La votación queda abierta para los participantes'
);
comprobar((await admin.locator('.tarjeta-mesa').count()) >= 1, 'Las ideas cargadas se listan');
await captura(admin, 'admin-ideas');

console.log('\n▸ Retos e ideas fuerza');
await page.reload({ waitUntil: 'networkidle' });
await esperarHash(page, 'semaforo');
await page.click('#btn-siguiente');
await page.waitForSelector('[data-categoria]');
await page.click('[data-categoria="Formación"]');
await page.click('[data-categoria="Proveedores"]');
await page.fill('#campo-reto', 'Necesitamos formación práctica en IA para el equipo y el voluntariado.');
await page.waitForTimeout(200);
await captura(page, 'retos');
await page.click('#btn-guardar-retos');
await page.waitForSelector('#aviso-retos .mensaje-ok', { timeout: 5000 });
comprobar(true, 'Los retos se guardan');
comprobar(await page.locator('#btn-votar').isVisible(), 'La votación de ideas fuerza está disponible');
await page.locator('[data-idea]').first().click();
comprobar(
  (await page.locator('[data-idea][aria-pressed="true"]').count()) === 1,
  'Se puede marcar una idea fuerza'
);
await page.locator('[data-idea]').nth(1).click();
comprobar(
  (await page.locator('[data-idea][aria-pressed="true"]').count()) === 2,
  'Se pueden marcar dos ideas fuerza'
);
await page.click('#btn-votar');
await page.waitForSelector('#aviso-voto .mensaje-ok', { timeout: 5000 });
comprobar(true, 'El voto se registra');
await captura(page, 'retos-votacion');

console.log('\n▸ Cierre');
await page.click('#btn-siguiente');
await page.waitForSelector('.mensajes, .titulo-grande');
comprobar((await page.locator('.titulo-grande').innerText()).includes('Lo que os lleváis'), 'La pantalla de cierre se muestra');
comprobar(
  (await page.locator('details.legal-detall .legal h4').count()) >= 8,
  'El cierre mantiene la información legal completa por capas'
);
comprobar(
  (await page.locator('a[href="/legal"]').count()) >= 1,
  'El cierre enlaza con la página legal'
);
await captura(page, 'cierre');

console.log('\n▸ Panel de dinamización · resto de pestañas');
await admin.click('[data-pestana="mesas"]');
await admin.waitForSelector('#guia-casos');
await admin.waitForTimeout(900);
comprobar((await admin.locator('.tarjeta-mesa').count()) >= 4, 'Muestra las respuestas por mesa');
comprobar(
  (await admin.locator('#guia-casos .tarjeta-mesa').count()) === 4,
  'Incluye la guía de resolución de los cuatro casos'
);
await captura(admin, 'admin-mesas');

await admin.click('[data-pestana="moderacion"]');
await admin.waitForSelector('.texto-moderar');
await esperarConteo(admin, '.texto-moderar', 4);
comprobar((await admin.locator('.texto-moderar').count()) >= 4, 'La revisión de textos lista los textos libres');
await admin.click('.texto-moderar .chip[data-estado="aprobado"]');
await admin.waitForTimeout(900);
comprobar((await admin.locator('.estado-aprobado').count()) > 0, 'Se puede aprobar un texto');
await captura(admin, 'admin-moderacion');

await admin.click('[data-pestana="descargas"]');
await admin.waitForSelector('img[src*="qr.svg"]');
await admin.waitForTimeout(900);
comprobar(await admin.locator('img[src*="qr.svg"]').isVisible(), 'Se muestra el código QR de acceso');
await captura(admin, 'admin-descargas');

await admin.click('[data-pestana="proyector"]');
await admin.waitForSelector('.proyector');
comprobar(true, 'La vista proyector funciona');
await captura(admin, 'admin-proyector');

console.log('\n▸ Cartela imprimible');
const cartel = await contexto.newPage();
await cartel.goto(`${BASE}/cartela`, { waitUntil: 'networkidle' });
await cartel.waitForSelector('.cartela-qr svg', { timeout: 8000 });
comprobar(true, 'La cartela incluye el código QR');
await cartel.screenshot({ path: `${DIR}/cartela.png`, fullPage: true });
console.log(`  📸 ${DIR}/cartela.png`);
await cartel.close();

console.log('\n▸ Página legal');
const legal = await contexto.newPage();
await legal.goto(`${BASE}/legal`, { waitUntil: 'networkidle' });
await legal.waitForSelector('h3');
comprobar((await legal.locator('h3').count()) >= 8, 'La página legal muestra todas las secciones');
await legal.screenshot({ path: `${DIR}/legal.png`, fullPage: true });
console.log(`  📸 ${DIR}/legal.png`);
await legal.close();

/* ---------------------------------------------------------------- */

console.log('\n▸ Privacidad');
comprobar(peticionesExternas.length === 0, `No se hace ninguna petición a terceros (${peticionesExternas.length})`);
if (peticionesExternas.length) console.error('   ', peticionesExternas.slice(0, 5));

const cookies = await contexto.cookies();
comprobar(cookies.length === 0, 'No se crea ninguna cookie');

const almacenamiento = await page.evaluate(() => ({
  local: Object.keys(localStorage).length,
  session: Object.keys(sessionStorage)
}));
comprobar(almacenamiento.local === 0, 'No se usa localStorage');
const permitidas = ['t4_codigo', 't4_semaforo'];
comprobar(
  almacenamiento.session.every((k) => permitidas.includes(k)),
  `sessionStorage solo contiene claves de sesión (${almacenamiento.session.join(', ')})`
);
comprobar(
  almacenamiento.session.every((k) => !/nombre|email|entidad|telefono/i.test(k)),
  'Ninguna clave de sesión alude a datos personales'
);

await navegador.close();

console.log(`\n${errores.length === 0 ? '✅ Recorrido completo sin errores' : `❌ ${errores.length} problema(s):`}`);
for (const e of errores) console.error('   -', e);
process.exit(errores.length === 0 ? 0 : 1);
