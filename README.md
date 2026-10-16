# Language Dangeon API

## Run with npm

To install dependencies:

```bash
npm install
```

To run local:

```bash
npm run start:dev
```

## Run with docker

build image

```bash
docker build -t ld.api .
```

run with port forwarding & env file

```bash
docker run -d -p 3000:3000 --env-file <ENV_FILENAME>  bun:LD.API
```

run with port forwarding & docker compose (use .env.prod filename)

```bash
docker compose up --build -d

```
