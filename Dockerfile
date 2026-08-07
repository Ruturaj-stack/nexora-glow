FROM oven/bun:1.3-alpine AS base
WORKDIR /app

# --- dependencies -----------------------------------------------------------
FROM base AS deps
COPY package.json bun.lock* bunfig.toml ./
RUN bun install --frozen-lockfile

# --- build ------------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG VITE_BUILD_NUMBER=local
ARG VITE_BUILD_COMMIT=dev
ENV VITE_BUILD_NUMBER=$VITE_BUILD_NUMBER
ENV VITE_BUILD_COMMIT=$VITE_BUILD_COMMIT
RUN bun run build

# --- runtime ----------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/.output ./.output
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/public/health || exit 1
USER bun
CMD ["bun", ".output/server/index.mjs"]
