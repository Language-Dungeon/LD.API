FROM node:26-alpine3.23 AS base
WORKDIR /usr/src/app

FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json package-lock.json /temp/dev/
RUN cd /temp/dev && npm install

RUN mkdir -p /temp/prod
COPY package.json package-lock.json /temp/prod/
RUN cd /temp/prod && npm ci --omit=dev

FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

RUN npm run build

FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/ .
COPY --from=prerelease /usr/src/app/package.json .

COPY --from=prerelease /usr/src/app/dist ./dist

RUN mkdir -p /usr/src/app/logs \ && chown -R node:node /usr/src/app

USER node

EXPOSE 3000
ENTRYPOINT ["npm", "run", "start:prod"]