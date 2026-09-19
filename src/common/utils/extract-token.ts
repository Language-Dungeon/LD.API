import { UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

export function extractAccesToken(req: Request) {
  const { signedCookies } = req;
  if (!signedCookies) throw new UnauthorizedException();

  const access = signedCookies["access_token"];
  console.log(access, signedCookies);
  if (typeof access === "string") {
    return access;
  }
  throw new UnauthorizedException();
}

export function extractRefreshToken(req: Request) {
  const { signedCookies } = req;
  if (!signedCookies) throw new UnauthorizedException();

  const refresh = signedCookies["refresh_token"];
  if (typeof refresh === "string") {
    return refresh;
  }

  throw new UnauthorizedException();
}
