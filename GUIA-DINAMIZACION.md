# Guía de dinamización de la app

**Taller 4 · Entidades seguras en un mundo digital**
Red Solidaria Santander · Pérez-Llorca · Fundación Fresno (secretaría técnica)

Esta guía explica, minuto a minuto, cómo usar la app durante la sesión de 90
minutos. Está pensada para la persona que va a proyectar: no hace falta saber
programar.

---

## Antes de la sala (30 minutos de trabajo previo)

| Qué | Cómo |
|---|---|
| **Levantar la app** | `npm start` (o el contenedor de Docker). Debe salir «App para participantes: https://…». |
| **Poner la contraseña** | Define `ADMIN_PASSWORD` antes de arrancar. Si no la defines, el servidor genera una y la muestra en consola y en `data/admin-password.txt`. |
| **Comprobar la URL** | `PUBLIC_URL` debe ser la dirección **pública** por la que entrarán los participantes. Si el wifi de invitados no llega al servidor, hay que publicarla por internet (ver `DEPLOY.md`). |
| **Probar el QR** | En `/admin` → «Descargas y privacidad» → «Abrir la cartela imprimible (A4)». Proyecta la cartela o el QR suelto. |
| **Probar con un móvil** | Escanea el QR con el móvil y recorre los cinco pasos. Es la prueba de fuego: si a ti te funciona, a ellos también. |
| **Copias de respaldo** | Imprime 4 copias del semáforo y de los cuatro escenarios (por si falla la conexión). |
| **Wifi** | Confirmar con el centro que la sala tiene wifi para invitados. Es lo único que puede hacer fracasar la dinámica. |

> **Consejo:** deja el panel de dinamización abierto en una segunda pestaña o en
> un portátil. La app de participantes va en el proyector; el panel, en tu
> pantalla de control.

---

## Los 90 minutos, paso a paso

### 0 · Bienvenida (1 min)

Proyecta la **cartela A4** (`/cartela`) o el QR en grande. Explica en una frase:

> «Esta app es solo para las preguntas del taller. No hay que registrarse, no
> hay que dar datos personales y lo que escribáis se borra a los 10 días.»

La gente entra con el móvil. **No hace falta que tod@s se conecten antes de
empezar**: la app se puede abrir en cualquier momento de la sesión.

---

### 1 · Termómetro digital (10 min)

1. Proyecta la **presentación** (diapositiva 3).
2. En el panel, vigila el contador **Participantes** en «Resultados en directo».
3. Cuando unas 20-30 personas hayan respondido, cambia a la **vista proyector**
   (pestaña «Vista proyector» del panel) y comenta los resultados en voz alta:
   - ¿Cuántas entidades usan ya IA? ¿Con herramientas de la entidad o las suyas?
   - ¿A cuántas les ha pasado algo (phishing, fraude, pérdida de información)?
   - ¿Quién tiene ya una pauta escrita?

**Mensaje que hay que dejar caer:** *«Ser pequeño o no tener ánimo de lucro no
exime. Lo que hay que poder demostrar es qué datos tenemos, para qué, quién
accede, qué proveedores los ven y qué hacemos si algo sale mal.»*

> Si hay tiempo, pregunta a mano a 2-3 entidades que hayan contestar «No lo sé»:
> es material bueno para la puesta en común.

---

### 2 · Lo esencial (15 min)

Aquí no se usa la app: es la presentación, diapositivas 4 a 8 (datos que
requieren cuidado, qué exige el RGPD, amenazas de ciberseguridad, marco
europeo de IA).

**Tienes el guion completo en el panel**, en la pestaña **«Guion «Lo esencial»»**:
cuatro bloques (A, B, C y D) con el mensaje que va en la diapositiva, los puntos
clave y el **semáforo de usos de IA** del bloque D. Debajo de cada bloque, la
**«nota del ponente»** recoge la base normativa completa: no se proyecta, es para
responder preguntas si alguien pregunta (p. ej., por qué el art. 30 no te exime
por tener menos de 250 personas, o por qué NIS2 no aplica a tu entidad).

---

### 3 · Trabajo en mesas (20 min)

1. Reparte las mesas (4-5 personas por mesa) y el **escenario** a cada una:
   el dinamizador puede dejar cada caso ya asignado a una mesa desde
   **«Mesas y casos»** (columna «Caso»).
2. En la app, cada persona entra en **«Mesas»**, elige su mesa y ve el caso que
   le toca. Si la mesa no tiene caso asignado, puede elegirlo.
3. La mesa escribe **las tres respuestas**: ¿qué riesgo veis?, ¿qué haríais? y
   ¿qué necesitaría vuestra entidad para evitarlo?
4. La app avisa si detecta algo que parece un dato personal (un correo, un
   teléfono, un enlace). **Pídele que lo reformule en el momento**: es el mejor
   momento para que entiendan la recomendación sin tener que dar la lección.
5. Modo de respuesta: por defecto **conjunta de la mesa** (la última respuesta
   guardada es la que se proyecta). Si queréis recoger aportes individuales,
   cambiad a «Respuesta individual».

**Mensaje que hay que dejar caer:** *«Herramienta gratuita = datos fuera de
vuestro control.»*

---

### 4 · Puesta en común (25 min)

En el panel, pestaña **«Mesas y casos»**, verás las respuestas de cada mesa
junto con la **guía de resolución** de los cuatro casos (qué está permitido,
qué precauciones adoptar, cómo reaccionar si ya ha pasado y la base normativa
para responder preguntas).

Para cada caso:

1. Proyecta la diapositiva del caso (11 a 14 de la presentación).
2. Lee en voz alta lo que puso la mesa (**sin leer nada que identifique**).
3. Aporta la respuesta práctica de la guía.
4. Si sale la pregunta legal concreta, la base normativa está en la guía, a pie
   de la diapositiva, para que la consultes sin proyectarla.

---

### 5 · Autodiagnóstico «semáforo» (10 min)

1. En la app, cada entidad marca las 10 medidas en verde, ámbar o rojo y elige
   **tres prioridades**.
2. Con el botón **«Ver autodiagnóstico»** cada quien puede imprimir o guardar
   su hoja en PDF y llevársela. Es lo que se llevan de la sesión.
3. En el panel, la tarjeta «Semáforo · 10 medidas» muestra la situación
   mayoritaria de cada medida. Es un buen punto para comentar en alto: *«La
   medida que más os cuesta es la 4 (pagos). Es también la que más se repite en
   el sector.»*

---

### 6 · Retos e ideas fuerza (10 min)

1. Cada entidad marca las categorías donde necesita apoyo (formación, recursos
   técnicos, asesoramiento jurídico, proveedores, financiación, cultura interna)
   y, si quiere, escribe su reto principal.
2. **Prepara la votación en directo** (es lo que pide el guion): ve al panel →
   **«Ideas fuerza»** y añade las ideas que han salido en las mesas. Cuantas
   más, mejor: si solo hay dos, la votación no aporta nada.
3. Pulsa **«Abrir votación»**. Los participantes ven la lista y eligen **dos**.
4. Al cerrar el bloque, mira el recuento en «Ideas fuerza · votación» y apunta
   las dos más votadas: son las **dos ideas fuerza** para el cierre de la
   jornada.

---

### 7 · Cierre (fuera de la app)

Cada taller aporta **dos ideas fuerza** y sus conclusiones al cierre general
(moderado por María Ruiz-Moyano). Anótalas antes de cerrar el taller.

---

## Después del taller (10 minutos)

| Qué | Dónde |
|---|---|
| **Releer los textos libres** y aprobar o rechazar cada uno | Panel → «Revisión de textos» |
| **Consultar la base normativa** de un bloque o de un caso | Panel → «Guion «Lo esencial»» |
| **Repasar lo pendiente antes de la sesión** | Panel → «Antes del taller» |
| **Descargar los resultados para Fresno** | Panel → «Descargas y privacidad» → «Resultados (CSV / JSON)» |
| **Descargar los textos revisados** (solo los aprobados) | Panel → «Descargas y privacidad» → «Textos revisados (CSV)» |
| **Comprobar el registro de auditoría** | Panel → «Descargas y privacidad» → «Registro de auditoría» |

### Qué se comparte con Fresno y qué no

| Se comparte | No se comparte |
|---|---|
| Recuentos del termómetro | Seudónimos |
| Recuentos de cada medida del semáforo | Respuestas individuales |
| Recuentos de retos por categoría | Textos originales |
| Recuento de participación en cada caso | Direcciones IP (no se registran) |
| Votación de ideas fuerza (sin quién votó) | Identificadores de dispositivo |

Los recuentos con **menos de 3 respuestas** se suprimen automáticamente
(`< 3`): con menos respuestas que esa, un recuento podría permitir
reidentificar a quien respondió.

El **texto libre** va en un fichero aparte, y solo si la persona dinamizadora
lo ha aprobado una a una.

### El borrado automático

Los datos brutos se borran solos **10 días después del taller** (fecha
configurable con `WORKSHOP_DATE` y `RETENTION_DAYS`). No hay que hacer nada,
pero el borrado queda escrito en el registro de auditoría.

Si necesitas borrarlo antes (por ejemplo, si se cae la sesión y hay que
rehacerla), el botón **«Borrar ahora los datos brutos»** lo hace y deja
constancia. Los recuentos agregados se conservan porque no son datos
personales.

---

## Preguntas frecuentes

**¿Se puede repetir el taller el mismo día?**
Sí. La contraseña del panel y el borrado manual están siempre disponibles.

**Una persona pierde el móvil a mitad de sesión.**
El código de sesión aparece arriba en la app. Si lo anota en el panel de
dinamización puede recuperar sus respuestas escribiéndolo en otra pantalla.
Si no, solo pierde lo que no hubiera guardado.

**Alguien escribe el nombre de su entidad o de una persona atendida.**
La app avisa en el momento. Si ya se ha enviado, la persona dinamizadora lo
ve en «Revisión de textos» y puede rechazarlo: el texto no saldrá nunca en las
exportaciones.

**¿Y si se cae internet?**
La app es «servidor propio»: si los participantes no llegan al servidor, no
funciona. Ten las copias impresas de los escenarios y del semáforo como plan B.
