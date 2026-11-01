# One image for both sites: the Node service (server/) plus the two built Astro sites.
# The service uses only Node built-ins, so the runtime stage ships no node_modules.

FROM node:22.12-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22.12-alpine
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    DATA_DIR=/data \
    MAIN_DIST=/app/dist \
    ALIYAPET_DIST=/app/dist-aliyapet
COPY server ./server
RUN rm -rf ./server/test ./server/deploy
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-aliyapet ./dist-aliyapet
# Release metadata and mirrored installers live here; mount it so they survive image updates.
VOLUME /data
EXPOSE 8787
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:8787/healthz >/dev/null || exit 1
CMD ["node", "server/index.mjs"]
