FROM node:22-alpine AS build

ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm/bin:/pnpm:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN npm install --global pnpm@11.9.0

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
RUN pnpm build && pnpm prune --prod

FROM node:22-alpine

ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm/bin:/pnpm:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN npm install --global pnpm@11.9.0 \
    && pnpm add --global supergateway@3.4.3

WORKDIR /app

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 8000

CMD ["node", "dist/remote.js"]
