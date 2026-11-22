#!/usr/bin/env bash
# =============================================================================
#  Taller 4 · «Entidades seguras en un mundo digital»
#  Despliegue automatizado en Render.
#
#  Qué hace, en este orden:
#    1. Publica el código en un repositorio de GitHub (sin secretos: el .env
#       y data/ están en el .gitignore).
#    2. Crea el servicio en Render con el Dockerfile del repositorio.
#    3. Dispara el despliegue y espera a que esté disponible.
#    4. Comprueba la URL pública con deploy/verificar.sh.
#
#  Credenciales (variables de entorno, no argumentos):
#    RENDER_API_KEY   API key de Render  (Dashboard → Account Settings → API Keys)
#    GITHUB_TOKEN     token de GitHub     (fine-grained, permiso de repositorios)
#
#  Uso:
#    RENDER_API_KEY=... GITHUB_TOKEN=... ./deploy/render-desplegar.sh
#
#  Variables opcionales:
#    REPO_NAME      nombre del repositorio (por defecto: taller4-entidades-seguras)
#    REPO_PRIVADO   "si" para crear el repositorio privado (requiere conectar el
#                   proveedor de Git en el panel de Render)
#    PLAN           plan de Render: free (por defecto) o starter
#    REGION         región: frankfurt, oregon, singapore…
#    RESPONSABLE    responsable del tratamiento que aparece en /legal
#    CONTACTO       correo de contacto que aparece en /legal
# =============================================================================

set -euo pipefail

BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BASE"

: "${RENDER_API_KEY:?falta RENDER_API_KEY}"
: "${GITHUB_TOKEN:?falta GITHUB_TOKEN}"

REPO_NAME="${REPO_NAME:-taller4-entidades-seguras}"
REPO_PRIVADO="${REPO_PRIVADO:-no}"
PLAN="${PLAN:-free}"
REGION="${REGION:-frankfurt}"
SERVICIO="${SERVICIO:-taller4-app}"
RESPONSABLE="${RESPONSABLE:-Pérez-Llorca}"
CONTACTO="${CONTACTO:-protecciondatos@perezllorca.com}"

verde() { printf '\033[32m%s\033[0m\n' "$1"; }
rojo()  { printf '\033[31m%s\033[0m\n' "$1"; }
gris()  { printf '\033[90m%s\033[0m\n' "$1"; }
paso()  { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }

# ---------------------------------------------------------------------------
# 1. GitHub: usuario y repositorio
# ---------------------------------------------------------------------------
paso "1/5 · Repositorio de GitHub"

GH_API="https://api.github.com"
gh() { curl -sS --max-time 40 -H "Authorization: Bearer $GITHUB_TOKEN" \
             -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" "$@"; }

# Comprobación previa: si el token falla, se dice claro y se para.
GH_USER=$(gh "$GH_API/user")
GH_LOGIN=$(printf '%s' "$GH_USER" | python3 -c 'import sys,json
try:
    print(json.load(sys.stdin).get("login",""))
except Exception:
    print("")' 2>/dev/null || true)

if [ -z "$GH_LOGIN" ]; then
  rojo "El token de GitHub no es válido o no tiene permisos."
  rojo "Crea un token fine-grained en https://github.com/settings/personal-access-tokens/new"
  rojo "con los permisos «Repository creation: Read and write» y «Contents: Read and write»."
  exit 1
fi
USUARIO="$GH_LOGIN"
verde "Autenticado en GitHub como: $USUARIO"

# Comprobación real de escritura: un «push en seco» autentica y pregunta a
# GitHub por los permisos, sin subir nada. Detecta el 403 antes de crear el
# repositorio y explica exactamente qué falta.
if [ ! -d ".git" ]; then
  git init -q
  git config user.email "taller4@perezllorca.local"
  git config user.name "Taller 4"
  git add -A >/dev/null 2>&1 || true
  git commit -q -m "comprobación" >/dev/null 2>&1 || true
fi
if ! git push --dry-run "https://x-access-token:${GITHUB_TOKEN}@github.com/${USUARIO}/${REPO_NAME}.git" main >/tmp/git-dry.err 2>&1; then
  rojo "El token de GitHub no puede escribir en repositorios."
  gris "$(sed -n '1,2p' /tmp/git-dry.err | tr '\n' ' ')"
  echo
  rojo "Abre https://github.com/settings/personal-access-tokens → tu token → Editar y comprueba:"
  rojo "  · Repository access → «All repositories»"
  rojo "  · Repository permissions → busca «Contents» y ponlo en «Read and write»"
  rojo "    (es un desplegable independiente; si está en «Read-only», no puede subir)"
  echo
  rojo "El valor del token no cambia al editarlo, así que no hace falta pegarlo otra vez."
  exit 1
fi
verde "El token tiene permiso de escritura en repositorios."

PRIVADO=false
[ "$REPO_PRIVADO" = "si" ] && PRIVADO=true

EXISTE=$(gh -o /dev/null -w '%{http_code}' "$GH_API/repos/$USUARIO/$REPO_NAME")
if [ "$EXISTE" = "200" ]; then
  verde "El repositorio $USUARIO/$REPO_NAME ya existe; se reutiliza."
else
  gh -X POST "$GH_API/user/repos" \
     -d "{\"name\":\"$REPO_NAME\",\"private\":$PRIVADO,\"description\":\"App del Taller 4 · Entidades seguras en un mundo digital\",\"auto_init\":false}" \
     -o /tmp/gh-repo.json -w 'HTTP %{http_code}\n'
  if [ "$(python3 -c 'import json;print(json.load(open("/tmp/gh-repo.json")).get("id",""))' 2>/dev/null)" = "" ]; then
    rojo "No se ha podido crear el repositorio:"
    cat /tmp/gh-repo.json; echo
    exit 1
  fi
  verde "Repositorio creado: $USUARIO/$REPO_NAME"
fi

# ---------------------------------------------------------------------------
# 2. Subir el código
# ---------------------------------------------------------------------------
paso "2/5 · Subir el código"

if [ ! -d ".git" ]; then
  git init -q
  git config user.email "taller4@perezllorca.local"
  git config user.name "Taller 4"
fi

git add -A
if git diff --cached --quiet; then
  gris "No hay cambios que subir."
else
  git commit -q -m "App del Taller 4 · Entidades seguras en un mundo digital"
fi

git branch -M main
if ! git push --force "https://x-access-token:${GITHUB_TOKEN}@github.com/${USUARIO}/${REPO_NAME}.git" main 2>/tmp/git-push.err; then
  rojo "GitHub ha denegado la subida (403)."
  gris "$(sed -n '1,2p' /tmp/git-push.err | tr '\n' ' ')"
  echo
  rojo "Causa habitual: el token es «fine-grained» y tiene el acceso a"
  rojo "repositorios limitado a una lista («Only select repositories»), que no"
  rojo "incluye el repositorio recién creado. Se puede crear el repositorio"
  rojo "pero no subir el código."
  echo
  rojo "Solución (no hace falta cambiar el valor del token):"
  rojo "  1. https://github.com/settings/personal-access-tokens"
  rojo "  2. Abre el token «Taller 4 despliegue» y pulsa Editar."
  rojo "  3. Repository access → «All repositories»."
  rojo "  4. Repository permissions → «Contents: Read and write»."
  rojo "  5. Guardar. El valor del token no cambia y el cambio es inmediato."
  exit 1
fi
verde "Código publicado en la rama main."

# ---------------------------------------------------------------------------
# 3. Render: espacio de trabajo
# ---------------------------------------------------------------------------
paso "3/5 · Servicio de Render"

RD_API="https://api.render.com/v1"
rd() { curl -sS --max-time 60 -H "Authorization: Bearer $RENDER_API_KEY" \
             -H "Accept: application/json" -H "Content-Type: application/json" "$@"; }

# La API devuelve una lista de envoltorios {"owner": {...}} con paginación por
# cursor, así que el id del espacio de trabajo está dentro de "owner".
# Comprobación previa de la clave de Render.
RD_OWNERS=$(rd "$RD_API/owners")
if printf '%s' "$RD_OWNERS" | grep -qi 'unauthorized'; then
  rojo "La API key de Render no es válida o ha caducado."
  exit 1
fi

WORKSPACE=$(printf '%s' "$RD_OWNERS" | python3 -c '
import sys,json
d=json.load(sys.stdin)
o=d if isinstance(d,list) else d.get("owners",[])
for x in o:
    w=x.get("owner",x)
    if w.get("id"):
        print(w["id"]); break
' 2>/dev/null || true)

if [ -z "$WORKSPACE" ]; then
  WORKSPACE=$(rd "$RD_API/organizations" | python3 -c '
import sys,json
d=json.load(sys.stdin)
o=d if isinstance(d,list) else d.get("organizations",[])
for x in o:
    w=x.get("organization",x.get("owner",x))
    if w.get("id"):
        print(w["id"]); break
' 2>/dev/null || true)
fi

if [ -z "$WORKSPACE" ]; then
  rojo "No se ha podido obtener el espacio de trabajo de Render."
  rojo "Créalo en https://dashboard.render.com/ y vuelve a intentarlo."
  exit 1
fi
verde "Espacio de trabajo: $WORKSPACE"

# ¿Existe ya un servicio con ese nombre?
EXISTE_SERV=$(rd "$RD_API/services" | python3 -c "
import sys,json
d=json.load(sys.stdin)
sv=d if isinstance(d,list) else d.get('services',[])
print(next((s.get('service',s).get('id','') for s in sv if s.get('service',s).get('name')=='$SERVICIO'),''))" 2>/dev/null || true)

ADMIN_PASSWORD=$(python3 -c "import secrets;print(secrets.token_urlsafe(18))")

if [ -n "$EXISTE_SERV" ]; then
  rojo "Ya existe un servicio llamado '$SERVICIO' (id $EXISTE_SERV)."
  gris "Se usa el existente. Borra el servicio antes si quieres uno nuevo."
  SERVICIO_ID="$EXISTE_SERV"
else
  cat > /tmp/cuerpo-servicio.json <<JSON
{
  "type": "web_service",
  "name": "$SERVICIO",
  "ownerId": "$WORKSPACE",
  "repo": "https://github.com/$USUARIO/$REPO_NAME",
  "branch": "main",
  "autoDeployTrigger": "off",
  "envVars": [
    {"key": "ADMIN_PASSWORD", "value": "$ADMIN_PASSWORD"},
    {"key": "WORKSHOP_DATE", "value": "2026-11-22"},
    {"key": "RETENTION_DAYS", "value": "10"},
    {"key": "MIN_N", "value": "3"},
    {"key": "RESPONSABLE", "value": "$RESPONSABLE"},
    {"key": "CONTACTO", "value": "$CONTACTO"},
    {"key": "ENTIDAD_ALOJAMIENTO", "value": "Render (proveedor de alojamiento de la app, encargado, art. 28 RGPD)"},
    {"key": "DESTINATARIO_EXTERNO", "value": "Fundación Fresno"}
  ],
  "serviceDetails": {
    "runtime": "docker",
    "env": "docker",
    "plan": "$PLAN",
    "region": "$REGION",
    "healthCheckPath": "/api/config"
  }
}
JSON

  rd -X POST "$RD_API/services" --data-binary @/tmp/cuerpo-servicio.json -o /tmp/render-servicio.json
  # Render responde con {"deployId": "...", "service": {...}}: el id del
  # servicio va anidado dentro de "service".
  SERVICIO_ID=$(python3 -c '
import json
d=json.load(open("/tmp/render-servicio.json"))
sv=d.get("service",d)
print(sv.get("id",""))' 2>/dev/null || true)
  if [ -z "$SERVICIO_ID" ]; then
    rojo "No se ha podido crear el servicio. Respuesta de Render:"
    cat /tmp/render-servicio.json; echo
    exit 1
  fi
  verde "Servicio creado: $SERVICIO_ID"
fi

# ---------------------------------------------------------------------------
# 4. Disco persistente y URL pública
# ---------------------------------------------------------------------------
paso "4/5 · Disco persistente, URL pública y despliegue"

# El disco persistente solo existe en planes de pago: en el gratuito se
# intenta, pero se avisa de que los datos se pierden cuando el servicio se
# duerme (por eso la app trae copia de seguridad y aviso de reinicio).
if [ "$PLAN" != "free" ]; then
  rd -X PATCH "$RD_API/services/$SERVICIO_ID" \
     -d '{"serviceDetails":{"plan":"'"$PLAN"'","disk":{"name":"datos","mountPath":"/app/data","sizeGB":1}}}' \
     -o /tmp/render-disk.json >/dev/null \
     && verde "Disco persistente montado en /app/data" \
     || gris "No se ha podido montar el disco persistente."
else
  gris "Plan gratuito: sin disco persistente. Los datos de la sesión se"
  gris "pierden cuando el servicio se duerme. Descarga una copia de seguridad"
  gris "desde «Descargas y privacidad» al terminar el taller."
fi

# La URL del servicio es predecible con el nombre.
URL="https://$SERVICIO.onrender.com"
rd -X PATCH "$RD_API/services/$SERVICIO_ID" \
   -d '{"envVars":[{"key":"PUBLIC_URL","value":"'"$URL"'"}]}' >/dev/null || true

# Disparar el despliegue.
rd -X POST "$RD_API/services/$SERVICIO_ID/deploys" -o /tmp/render-deploy.json >/dev/null
verde "Despliegue disparado. Construyendo la imagen…"
gris "(La primera construcción puede tardar varios minutos.)"

for i in $(seq 1 60); do
  ESTADO=$(rd "$RD_API/services/$SERVICIO_ID" | python3 -c '
import sys,json
s=json.load(sys.stdin).get("service",{})
print(s.get("serviceDetails",{}).get("suspended","?"), s.get("updatedAt",""))' 2>/dev/null || echo "?")
  if curl -s -o /dev/null --max-time 12 -w '' "$URL/api/config" 2>/dev/null; then
    break
  fi
  gris "  esperando… ($i) $ESTADO"
  sleep 20
done

# ---------------------------------------------------------------------------
# 5. Comprobación
# ---------------------------------------------------------------------------
paso "5/5 · Comprobación del despliegue"

if curl -s -o /dev/null --max-time 15 "$URL/"; then
  verde "La app responde en $URL"
else
  rojo "La app todavía no responde. Mira el log en el panel de Render."
fi

./deploy/verificar.sh "$URL" || true

echo
verde "Despliegue terminado."
echo
if [ "$PLAN" = "free" ]; then
  gris "AVISO (plan gratuito): el servicio se duerme a los 15 min sin tráfico y"
  gris "tarda ~1 min en despertar, y pierde los datos de la sesión al dormir."
  gris "Antes del taller: abre la URL 10 min antes y deja el panel abierto."
  gris "Al terminar: descarga la copia de seguridad desde «Descargas y privacidad»."
  echo
fi
echo
echo "  URL de la app      : $URL"
echo "  Panel de dinamiz.  : $URL/admin"
echo "  Cartel con QR      : $URL/cartela"
echo "  Contraseña panel   : $ADMIN_PASSWORD"
echo
gris "Guarda la contraseña del panel. Guárdala en el gestor de contraseñas"
gris "de la organización: da acceso a los datos agregados y a la moderación."
