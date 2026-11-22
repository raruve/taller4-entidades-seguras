# Puesta en marcha de la app

Cómo llevar la app a internet (o a la red de la sala) para el taller.

---

## Antes de nada: dos decisiones

### 1. ¿Dónde vive la app?

| Opción | Cuándo | Coste |
|---|---|---|
| **Un servidor propio (VPS)** | Si ya tenéis un servidor o una máquina virtual | ~5-15 €/mes |
| **Render / Railway / Fly.io** | Si queréis algo funcionando en minutos, sin administrar | 0 € → 7 €/mes |
| **La red local de la sala** | Si el wifi de invitados llega al ordenador de la sala | 0 € |
| **PortaForwarding en la red del centro** | Si hay wifi de invitados pero sin salida a internet | 0 € |

### 2. ¿Hace falta HTTPS?

**Sí, y de hecho es muy recomendable.** Con `http://` en un dominio propio,
algunos móviles avisan de que la conexión no es segura y la experiencia se
resiente. Además, algunas funciones del navegador (como la cámara del
navegador) solo funcionan en contexto seguro.

- Si publicas en internet, usa el HTTPS que te dé tu proveedor (Render, Railway
  y Fly lo hacen automáticamente).
- Si la app se queda en la red local, `http://192.168.x.x:3000` funciona
  perfectamente con Android y con iPhone (Safari abre las páginas http sin
  problema; lo que no funciona es la cámara del navegador, y aquí la cámara
  no se usa: el participante apunta con la cámara **de su móvil** a un QR que
  está en la pantalla del proyector).

---

## Opción A · Render (recomendada si no hay servidor)

1. Sube el código a un repositorio de Git.
2. En Render, «New → Web Service» y apunta al repositorio.
3. Render detecta el `Dockerfile` (o usa `npm start`).
4. Variables de entorno:

   ```
   ADMIN_PASSWORD=<contraseña larga>
   WORKSHOP_DATE=2026-11-22
   RETENTION_DAYS=10
   PUBLIC_URL=https://tu-servicio.onrender.com
   ```

5. Despliega. La app queda en `https://tu-servicio.onrender.com`.

> El `render.yaml` de este repositorio deja la configuración lista para un
> despliegue con un clic (disco persistente para `data/`).

**Aviso importante:** el plan gratuito de Render apaga el servicio cuando no
hay tráfico. En un taller con 25 personas entrando a la vez en un minuto
concreto, la primera petición puede tardar unos segundos. Si puedes, usa el
plan de pago (7 €/mes) o **«always on»**; la alternativa es entrar 5 minutos
antes y dejar una pestaña abierta para despertarlo.

---

## Opción B · Docker + nginx en un servidor propio

La opción elegida para este taller. La app corre en un contenedor y nginx
hace de proxy inverso con HTTPS delante.

### Requisitos del servidor

- Un servidor o VPS con **Debian/Ubuntu** y un dominio que apunte a su IP
  (el dominio es necesario para el certificado HTTPS).
- **Docker Engine** y el plugin **Compose**.
- **nginx** y **certbot**.

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER      # cierra la sesión y vuelve a entrar
```

### 1. Copiar la app

```bash
sudo mkdir -p /opt/taller4
sudo chown $USER /opt/taller4
cd /opt/taller4
# descomprime aquí app-taller4-entidades-seguras.zip, de modo que quede
# /opt/taller4/app/...
cd app
```

### 2. Configurar las variables de entorno

```bash
cp .env.ejemplo .env
chmod 600 .env
nano .env
```

Rellena como mínimo:

| Variable | Qué poner |
|---|---|
| `ADMIN_PASSWORD` | Una contraseña larga y única para el panel. Sin ella, el servidor genera una y la guarda en el volumen. |
| `PUBLIC_URL` | `https://taller4.tudominio.com` — es la URL que codifica el QR. |
| `ENTIDAD_ALOJAMIENTO` | El nombre real de quien hospeda el servidor. Aparece en la información legal como encargado (art. 28 RGPD). |
| `RESPONSABLE`, `CONTACTO` | Los datos reales del responsable del tratamiento. |
| `WORKSHOP_DATE` | `2026-11-22`. De ella depende el borrado automático. |

> `PUBLIC_URL` debe ser exactamente la URL por la que entran las personas
> participantes. Si cambias el dominio después, hay que redeployar o reiniciar
> el contenedor para que el QR apunte al sitio correcto.

### 3. Levantar la app

```bash
docker compose up -d --build
docker compose logs -f app
```

La app queda escuchando **solo en `127.0.0.1:3000`**: desde internet no se ve
directamente, hay que pasar por nginx. Los datos viven en el volumen
`taller4-data`.

Comprobación rápida:

```bash
curl -s http://127.0.0.1:3000/api/config | head -c 200
```

### 4. nginx delante

Hay una configuración lista en `deploy/nginx/taller4.conf`. Cópiala y ajusta
las dos apariciones de `taller4.example.org` por tu dominio:

```bash
sudo cp deploy/nginx/taller4.conf /etc/nginx/sites-available/taller4
sudo nano /etc/nginx/sites-available/taller4
sudo ln -s /etc/nginx/sites-available/taller4 /etc/nginx/sites-enabled/taller4
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

> **Lo importante de este fichero** (apartado 6 del documento de preparación):
>
> - `access_log off;` — nginx **no escribe** la IP de cada participante en
>   `/var/log/nginx/access.log` durante los 90 minutos del taller.
> - `proxy_set_header X-Real-IP "";` y `proxy_set_header X-Forwarded-For "";` —
>   la IP del visitante **ni siquiera llega a la app**. No se conserva y no se
>   procesa en ningún momento.
> - El `log_format` del log de errores tampoco incluye la dirección IP.
>
> Si usas Cloudflare por delante, ponlo en «Sin caché» y desactiva los
> «Registros de actividad» del plan gratuito.

### 5. Certificado HTTPS

```bash
sudo certbot --nginx -d taller4.tudominio.com
```

certbot modifica el fichero de nginx para Renew. Comprueba que la renovación
automática está activa:

```bash
sudo certbot renew --dry-run
```

### 6. Verificar el despliegue

El repositorio incluye un comprobador que valida, contra la URL pública, los
requisitos de privacidad del documento:

```bash
./deploy/verificar.sh https://taller4.tudominio.com
```

Comprueba que no hay peticiones a terceros, que no se instalan cookies, que el
panel responde 401 sin contraseña, que el backend devuelve JSON (es decir, que
no es un sitio estático) y que la información del art. 13 RGPD está publicada.
Debe terminar con «Todo correcto».

### 7. Cortafuegos

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

El puerto 3000 **no** se abre: solo lo escucha nginx en localhost.

### Operación diaria

| Qué | Cómo |
|---|---|
| Ver el log de la app | `docker compose logs -f app` |
| Reiniciar | `docker compose restart app` (cierre ordenado: no corta respuestas a medias) |
| Parar | `docker compose down` |
| Acceder a los datos | `docker compose exec app ls -la /app/data` |
| Copiar los resultados | `docker compose exec app cat /app/data/agregados.json > agregados.json` |

> Para extraer los ficheros que van a Fresno, usa siempre las **exportaciones
> del panel** («Descargas y privacidad»), no el contenido de `/app/data`: las
> exportaciones aplican la supresión de celdas pequeñas y solo incluyen los
> textos que hayas revisado.

### Volver atrás

```bash
docker compose down          # para la app
sudo rm /etc/nginx/sites-enabled/taller4
sudo systemctl reload nginx
```

## Opción C · Red local de la sala

```bash
ADMIN_PASSWORD=... npm start
```

Y proyectad esta dirección en la pantalla:

```
http://<IP-del-ordenador>:3000
```

Para conocer la IP: `ip addr` (Linux/macOS) o `ipconfig` (Windows). El
ordenador y los móviles tienen que estar en la misma red y el cortafuegos
tiene que permitir el puerto 3000.

Si la red de invitados es de otra VLAN y no llega al ordenador, hay que pedir
al centro que abra el puerto o usar una red de invitados con salida.

---

## Opción D · Portátil «todo en uno» para el día

Si no hay tiempo de desplegar nada, la app puede funcionar en un portátil
con la red local, siempre que el wifi de invitados llegue a ese portátil.

---

## ⚠️ Si se despliega en el plan gratuito de Render

El plan gratuito tiene dos limitaciones que conviene tener presentes:

| Limitación | Qué significa | Qué hemos hecho |
|---|---|---|
| **Se duerme a los 15 min sin tráfico** y tarda **~1 min** en despertar | La primera persona que abra el QR tras un rato sin actividad espera alrededor de un minuto | El panel refresca solo cada 15 s, así que **con el panel abierto el servicio no se duerme**. Aun así, ábrelo 10 minutos antes de empezar. |
| **No admite disco persistente** | Todo lo que hay en `data/` (respuestas, mesas, ideas, agregados, auditoría) **se pierde cuando el servicio se duerme o se reinicia** | El panel avisa si detecta un reinicio, y hay **copia de seguridad** descargable y restaurable. |

Esto no es un detalle menor: sin disco, si el servicio se duerme entre la
puesta en común y la descarga de resultados para Fresno, esos resultados se
habrían perdido. Con las dos medidas de arriba (despertar antes, descargar la
copia al terminar) el plan gratuito es perfectamente utilizable para un taller
de 90 minutos.

**El plan de pago (`starter`, 7 €/mes) sí admite disco persistente** y con él
el problema desaparece: las respuestas sobreviven a cualquier reinicio y el
borrado a los 10 días queda hecho de forma automática y documentada. Si el
presupuesto lo permite, es lo recomendable.

### Rutina con el plan gratuito

| Cuándo | Qué hacer |
|---|---|
| 10 min antes del taller | Abre la URL de la app y deja el panel de dinamización abierto. El servicio se despierta y ya no se duerme. |
| Durante el taller | El panel refresca solo. Si ves el aviso «El servicio se ha reiniciado», restaura la copia. |
| Al terminar, **antes de cerrar el panel** | Panel → «Descargas y privacidad» → **Descargar copia**. Guárdala en el ordenador. |
| Después | Descarga también los resultados agregados para Fresno y los textos revisados. |

---

## Lista de comprobación del día del taller

- [ ] La app responde en la URL pública (prueba con el móvil y con datos
      móviles, no solo con el wifi de la sala).
- [ ] El QR de `/admin/qr.svg` lleva a la URL correcta (escanéalo tú).
- [ ] `ADMIN_PASSWORD` está puesta y la sabes.
- [ ] `WORKSHOP_DATE` es la fecha correcta: de ella depende el borrado.
- [ ] La red de invitados tiene salida a internet (si la app está en internet).
- [ ] El panel de dinamización está abierto en una pantalla aparte.
- [ ] Impresas las copias de respaldo: escenarios y semáforo.
- [ ] Al final: revisión de textos, descarga de resultados para Fresno y
      comprobación del registro de auditoría.
- [ ] Al final: **copia de seguridad** descargada desde «Descargas y
      privacidad» (imprescindible si el alojamiento no tiene disco).

---

## Después del taller

1. **Aprobar o rechazar** cada texto libre (panel → «Revisión de textos»).
2. **Descargar** los resultados agregados y los textos revisados.
3. **Enviar** a Fresno solo esos ficheros. No enviar nunca `data/`.
4. Comprobar en el panel que la fecha de borrado automático es correcta.
5. El borrado ocurre solo; si necesitas que ocurra antes, botón «Borrar ahora
   los datos brutos».

---

## Datos que nunca hay que compartir

| No compartir | Por qué |
|---|---|
| `data/respuestas.json` | Contiene las respuestas con su seudónimo. |
| `data/agregados.json` | Recuentos; no son datos personales, pero no hacen falta fuera de la app. |
| `data/config.json` | Mesas e ideas de la sesión. |
| `data/admin-password.txt` | La contraseña del panel. |
| `data/auditoria.log` | Registro interno. |
| La contraseña del panel | Va en la cabecera `X-Admin-Token`, no en la URL. |

Lo único que sale de la app hacia la Red Solidaria son los ficheros exportados
desde «Descargas y privacidad», y el de textos solo si has revisado cada
respuesta uno a uno.
