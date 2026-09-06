/**
 *  @author {przdev7}
 *
 *  Bun requires to add here external librariers (these are used by nestjs) to valid build.
 *  if you ever have a problem with build, which says that some packages are required (and they are already installed) then add package name here.
 */

await Bun.build({
  entrypoints: ["src/main.ts"],
  outdir: "dist",
  target: "bun",
  external: ["@nestjs", "perf_hooks", "class_validator", "class-transformer", "tls", "@libsql/client"],
});
