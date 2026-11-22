# Imagen de producción de la app del Taller 4.
# Node 22 (alpine), sin dependencias de terceros.
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATA_DIR=/app/data

WORKDIR /app

# Solo se copian primero los ficheros de dependencias para aprovechar la caché
# de Docker (no hay dependencias, pero el patrón se mantiene por si se añaden).
COPY package.json ./
COPY server ./server
COPY public ./public
COPY tools ./tools

RUN mkdir -p /app/data && chown -R node:node /app

USER node
VOLUME ["/app/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/config').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
