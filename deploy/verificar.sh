#!/usr/bin/env bash
# =============================================================================
#  Taller 4 · «Entidades seguras en un mundo digital»
#  Comprobación del despliegue antes del taller.
#
#  Verifica, contra la URL pública, los requisitos del apartado 6 del
#  documento de preparación:
#    · la app no llama a servicios de terceros (ni CDN, ni analítica, ni píxeles)
#    · no se instalan cookies
#    · el panel de dinamización está protegido
#    · el backend responde (aggregación y borrado programático)
#    · la información del art. 13 RGPD está publicada
#
#  Uso:
#      ./deploy/verificar.sh https://taller4.perezllorca.com
#
#  Sale con código 0 si todo está correcto y 1 si hay algún fallo.
# =============================================================================

set -uo pipefail

URL="${1:-}"
if [ -z "$URL" ]; then
  echo "Uso: $0 <url-publica-de-la-app>" >&2
  exit 2
fi

URL="${URL%/}"
FALLOS=0

verde()  { printf '\033[32m%s\033[0m\n' "$1"; }
rojo()   { printf '\033[31m%s\033[0m\n' "$1"; }
gris()   { printf '\033[90m%s\033[0m\n' "$1"; }

comprobar() {
  local titulo="$1" condicion="$2" detalle="${3:-}"
  if [ "$condicion" = "0" ]; then
    verde "  OK  $titulo"
    [ -n "$detalle" ] && gris "        $detalle"
  else
    rojo "  FALLO  $titulo"
    [ -n "$detalle" ] && gris "        $detalle"
    FALLOS=$((FALLOS + 1))
  fi
}

echo
echo "Comprobación del despliegue de la app del Taller 4"
echo "URL: $URL"
echo

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# ---------------------------------------------------------------------------
echo "[1] La app carga"
CODIGO=$(curl -s -o "$TMP/inicio.html" -w '%{http_code}' --max-time 20 "$URL/")
comprobar "la página de inicio responde 200" "$([ "$CODIGO" = "200" ] && echo 0 || echo 1)" "código $CODIGO"

TITULO=$(grep -o '<title>[^<]*</title>' "$TMP/inicio.html" | head -1)
comprobar "el título es el del Taller 4" \
  "$(echo "$TITULO" | grep -qi 'entidades seguras' && echo 0 || echo 1)" "$TITULO"

# ---------------------------------------------------------------------------
echo
echo "[2] Sin servicios de terceros (apartado 6 del documento)"

EXTERNOS=$(grep -o -E 'https?://[a-zA-Z0-9.-]+\.[a-z]{2,}[^"'"'"' )]*' "$TMP/inicio.html" \
  | grep -v -E "^https?://(localhost|127\.0\.0\.1|${URL#https://}|${URL#http://})" \
  | sort -u)

if [ -z "$EXTERNOS" ]; then
  comprobar "no hay URLs externas en el HTML" 0
else
  comprobar "no hay URLs externas en el HTML" 1 "$(echo "$EXTERNOS" | tr '\n' ' ')"
  rojo "        → revisa si hay CDN de fuentes, analítica o píxeles"
fi

if grep -qi -E 'googleapis|gstatic|googletagmanager|analytics|gtag\(|hotjar|clarity|segment\.io|mixpanel' "$TMP/inicio.html"; then
  comprobar "no hay analítica ni píxeles" 1 "se ha encontrado una referencia en el HTML"
else
  comprobar "no hay analítica ni píxeles" 0
fi

# ---------------------------------------------------------------------------
echo
echo "[3] Sin cookies"

CABECERAS=$(curl -s -D - -o /dev/null --max-time 20 "$URL/")
if echo "$CABECERAS" | grep -qi '^set-cookie:'; then
  comprobar "la respuesta no instala cookies" 1 \
    "$(echo "$CABECERAS" | grep -i '^set-cookie:' | head -2 | tr '\n' ' ')"
else
  comprobar "la respuesta no instala cookies" 0
fi

# ---------------------------------------------------------------------------
echo
echo "[4] El backend está vivo"

CT=$(curl -s -o "$TMP/config.json" -w '%{content_type}' --max-time 20 "$URL/api/config")
comprobar "/api/config devuelve JSON (hay servidor, no solo ficheros estáticos)" \
  "$(echo "$CT" | grep -qi 'application/json' && echo 0 || echo 1)" "tipo de contenido: $CT"

CASOS=$(grep -o '"id":[0-9]' "$TMP/config.json" 2>/dev/null | wc -l | tr -d ' ')
comprobar "el contenido del taller está cargado (4 casos)" \
  "$([ "${CASOS:-0}" -ge 4 ] && echo 0 || echo 1)" "casos detectados: ${CASOS:-0}"

CODIGO=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$URL/api/qr.svg")
comprobar "el código QR se genera en el servidor" \
  "$([ "$CODIGO" = "200" ] && echo 0 || echo 1)" "código $CODIGO"

# ---------------------------------------------------------------------------
echo
echo "[5] El panel de dinamización está protegido"

CODIGO=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$URL/api/admin/resumen")
comprobar "sin contraseña, el panel responde 401" \
  "$([ "$CODIGO" = "401" ] && echo 0 || echo 1)" "código $CODIGO"

CODIGO=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$URL/admin")
comprobar "la pantalla de acceso al panel carga" \
  "$([ "$CODIGO" = "200" ] && echo 0 || echo 1)" "código $CODIGO"

CODIGO=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$URL/panel")
comprobar "la pantalla de acceso del panel del ponente carga" \
  "$([ "$CODIGO" = "200" ] && echo 0 || echo 1)" "código $CODIGO"

CODIGO=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$URL/api/admin/panel")
comprobar "sin contraseña, los datos del panel del ponente responden 401" \
  "$([ "$CODIGO" = "401" ] && echo 0 || echo 1)" "código $CODIGO"

# ---------------------------------------------------------------------------
echo
echo "[6] Información del art. 13 RGPD publicada"

CODIGO=$(curl -s -o "$TMP/legal.html" -w '%{http_code}' --max-time 20 "$URL/legal")
comprobar "la página /legal responde 200" \
  "$([ "$CODIGO" = "200" ] && echo 0 || echo 1)" "código $CODIGO"

# El texto legal se pinta en el navegador a partir de /api/config, así que
# la comprobación se hace sobre la API, que es donde viaja el contenido.
LEGAL=$(curl -s --max-time 20 "$URL/api/config")

if echo "$LEGAL" | grep -qi '10 d'; then
  comprobar "se informa del borrado a los 10 días" 0
else
  comprobar "se informa del borrado a los 10 días" 1 "no se ha encontrado la referencia"
fi

if echo "$LEGAL" | grep -qi -E 'art\.? ?13|rgpd|protección de datos'; then
  comprobar "se cita la base legal (RGPD)" 0
else
  comprobar "se cita la base legal (RGPD)" 1
fi

if echo "$LEGAL" | grep -qi -E 'encargado|alojamiento|art\.? ?28'; then
  comprobar "se identifica al proveedor de alojamiento (art. 28)" 0
else
  comprobar "se identifica al proveedor de alojamiento (art. 28)" 1 \
    "rellena ENTIDAD_ALOJAMIENTO en el fichero .env"
fi

# El bloque «Destinatarios» de la información legal debe existir y dejar claro
# que el destinatario externo (Fresno) recibe solo agregados.
if echo "$LEGAL" | grep -q '"titulo":"Destinatarios"' && echo "$LEGAL" | grep -qi 'agregados'; then
  comprobar "se informa del destinatario externo de los agregados" 0
else
  comprobar "se informa del destinatario externo de los agregados" 1 \
    "falta el bloque «Destinatarios» en la información legal"
fi

# ---------------------------------------------------------------------------
echo
if [ "$FALLOS" -eq 0 ]; then
  verde "Todo correcto. La app está lista para el taller."
  exit 0
else
  rojo "Hay $FALLOS comprobación(es) fallida(s). Revísalas antes del taller."
  exit 1
fi
