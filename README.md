# Taller 4 · Entidades seguras en un mundo digital — App

App móvil (web) para acompañar el **Taller 4** del encuentro anual de la Red
Solidaria Santander: termómetro digital, casos en mesas, autodiagnóstico
«semáforo» y recogida de retos e ideas fuerza.

Sin registro, sin cookies, sin analítica, sin peticiones a terceros y sin
dependencias: la app es Node.js puro y sirve sus propios recursos.

---

## Puesta en marcha rápida

```bash
cd app
npm start                      # http://localhost:3000
```

Con contraseña de panel definida:

```bash
ADMIN_PASSWORD="una-contraseña-larga" WORKSHOP_DATE="2026-11-22" npm start
```

La consola muestra la URL de la app, la del panel de dinamización y la fecha
en la que se borrarán los datos brutos.

| Variable | Por defecto | Para qué sirve |
|---|---|---|
| `PORT` | `3000` | Puerto de escucha. |
| `HOST` | `0.0.0.0` | Interfaz de escucha. |
| `ADMIN_PASSWORD` | aleatoria | Contraseña del panel de dinamización. |
| `WORKSHOP_DATE` | `2026-11-22` | Fecha del taller; marca el inicio del plazo de conservación. |
| `RETENTION_DAYS` | `10` | Días que se conservan los datos brutos. |
| `MIN_N` | `3` | Recuentos por debajo de este valor se suprimen en las exportaciones. |
| `PUBLIC_URL` | — | Dirección pública de la app (la que codifica el QR). |
| `DATA_DIR` | `./data` | Dónde se guardan los datos y el registro de auditoría. |
| `RESPONSABLE`, `CONTACTO`, `BASE_LEGAL`, `ENLACE_INFO` | valores por defecto | Datos del responsable que aparecen en la información del art. 13 RGPD. |

> La contraseña aleatoria se guarda en `data/admin-password.txt` (permisos
> restringidos) y se muestra en consola al arrancar. **Fíjala con
> `ADMIN_PASSWORD` antes de usar la app en serio.**

---

## Qué hace

### Para las personas participantes (`/`)

1. **Inicio** — qué es la app, cómo va a funcionar y la información del
   art. 13 RGPD en capas.
2. **Termómetro digital** — tres preguntas de respuesta cerrada.
3. **Mesas** — el escenario asignado, tres preguntas con aviso previo y
   detector de posibles datos personales.
4. **Semáforo** — diez medidas en verde/ámbar/rojo y tres prioridades, con
   hoja imprimible descargable.
5. **Retos e ideas fuerza** — categorías predefinidas, reto opcional y
   votación en directo de las dos ideas fuerza.
6. **Cierre** — los cuatro mensajes para recordar y las prioridades propias.

### Para el equipo dinamizador (`/admin`)

- Resultados en directo, con vista proyector.
- **Guion «Lo esencial»**: los cuatro bloques de 15 minutos con el mensaje de la
  diapositiva, el semáforo de usos de IA y la nota del ponente con la base
  normativa (no se proyecta).
- Configuración de mesas y asignación de casos.
- Respuestas por mesa y **guía de resolución** de los cuatro casos.
- Preparación de las ideas fuerza y apertura de la votación.
- Revisión (aprobación/rechazo) de todos los textos libres.
- Exportaciones para la Red Solidaria (CSV y JSON).
- Código QR de acceso, cartela A4 imprimible, registro de auditoría y borrado
  manual.
- **Antes del taller**: lista de puntos a verificar, objetivos y resultados
  esperados.

Guía paso a paso: **[GUIA-DINAMIZACION.md](GUIA-DINAMIZACION.md)**.

---

## Diseño de privacidad

El documento de preparación del taller fija unas reglas muy estrictas. La app
las cumple por construcción:

| Regla | Cómo se cumple |
|---|---|
| Sin registro ni cuentas | No hay identificadores de usuario ni contraseñas de participante. |
| Seudónimo no vinculable a una persona | El navegador genera un código aleatorio; el servidor guarda **solo su hash SHA-256**. Nunca se crea una tabla de correspondencias. |
| Sin direcciones IP | El servidor no accede nunca a `req.socket.remoteAddress` y no tiene registro de peticiones. |
| Sin cookies, analítica ni píxeles | Ninguna cookie, ningún script de terceros, ninguna fuente externa. `sessionStorage` solo para el código de sesión y el autodiagnóstico en curso. |
| Respuestas cerradas preferidas | El termómetro, el semáforo y las categorías de reto son de opción cerrada. |
| Texto libre revisado antes de exportar | El texto libre sale únicamente en un CSV aparte, tras aprobación uno a uno. |
| Fresno solo recibe datos agregados | La exportación principal no incluye seudónimos, respuestas individuales ni textos. Los recuentos pequeños se suprimen (`< 3`). |
| Borrado a los 10 días | Borrado automático al cumplir el plazo, con constancia en el registro de auditoría. |
| Información del art. 13 en la pantalla de inicio | Texto en capas: resumen visible + versión larga desplegable + página `/legal`. |

Cabeceras de seguridad aplicadas: CSP sin scripts en línea, `no-referrer`,
`nosniff`, `frame-ancestors 'none'` y `Cache-Control: no-store` en la API.

---

## Estructura

```
app/
├── server/
│   ├── index.js      servidor HTTP, API y cabeceras de seguridad
│   ├── config.js     configuración por variables de entorno
│   ├── content.js    contenido del taller (preguntas, casos, semáforo…)
│   ├── store.js      persistencia, agregados, moderación y borrado
│   ├── export.js     exportaciones agregadas para la Red Solidaria
│   └── qr.js         codificador de QR propio (sin dependencias)
├── public/
│   ├── index.html    app de participantes
│   ├── admin.html    panel de dinamización
│   ├── imprimir.html autodiagnóstico imprimible
│   ├── cartel.html   cartela A4 con el QR
│   ├── legal.html    información del art. 13 RGPD
│   ├── app.js        lógica de la app de participantes
│   ├── admin.js      lógica del panel
│   └── styles.css    sistema visual (paleta «PLL 2024»)
├── test/
│   ├── qr.test.js    verificación del codificador de QR
│   └── recorrido.mjs recorrido completo con navegador real
├── tools/
│   └── generar-iconos.js
├── deploy/
│   ├── nginx/taller4.conf  proxy inverso con HTTPS y sin registro de IP
│   └── verificar.sh         comprobación del despliegue contra la URL pública
├── .env.ejemplo            plantilla de variables de entorno
├── Dockerfile
├── render.yaml
├── docker-compose.yml
├── DEPLOY.md
├── GUIA-DINAMIZACION.md
└── README.md
```

---

## Verificación

```bash
npm test                  # decodifica los QR generados con un lector independiente
npm run test:e2e          # recorre la app entera en un navegador y hace capturas
```

El test del recorrido necesita `playwright` (solo en desarrollo) y comprueba,
entre otras cosas, que no hay peticiones a terceros, que no se crean cookies y
que `localStorage` está vacío.

```bash
npm install --save-dev playwright
npx playwright install chromium
ADMIN_PASSWORD=pruebas node server/index.js &   # en otra terminal
npm run test:e2e -- http://localhost:3000
```

---

## Licencia y uso interno

Material de trabajo interno para la Red Solidaria Santander y Pérez-Llorca.
La marca y el logotipo son propiedad de sus titulares.
