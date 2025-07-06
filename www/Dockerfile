# FROM alpine:3.20.6
FROM scratch AS build
COPY dist /app

FROM oven/bun:1.2.18-alpine AS base
WORKDIR /app

FROM base AS release
COPY --from=build /app .

# run the app
USER bun
EXPOSE 80/tcp
ENV BUN_PORT=80
ENTRYPOINT [ "bun", "run", "index.js" ]
