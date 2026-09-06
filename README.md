# orp-backend

## Run with bun

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run start:dev
```

## Run with docker

build image

```bash
docker build -t bun:LD.API .
```

run with port forwarding & env file

```bash
docker run -d -p 3000:3000 --env-file <ENV_FILENAME>  bun:LD.API
```
