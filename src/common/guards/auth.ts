import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Cache } from "@nestjs/cache-manager";
import type { Request } from "express";
import { extractAccesToken, extractRefreshToken } from "@common";

import {
  IS_PUBLIC_PROVIDER,
  FAMILY_KEY,
  type Config,
  type ITokenRotationCachePayload,
  type JwtRefreshPayload,
  type JwtPayload,
  BLACKLIST_KEY,
} from "@types";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly cache: Cache,
    private readonly config: ConfigService<Config>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_PROVIDER, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    if (req.path !== "/auth/refresh") {
      const access = extractAccesToken(req);
      await this.verifyAccess(access, req);
    }

    const refresh = extractRefreshToken(req);
    await this.verifyRefresh(refresh, req);

    return true;
  }

  private async verifyAccess(token: string, req: Request): Promise<boolean> {
    const user = await this.jwt.verifyAsync<JwtPayload>(token, {
      secret: this.config.getOrThrow("JWT_SECRET"),
      issuer: "backend:revenger",
      audience: "backend:revenger",
    });

    const payload = await this.cache.get<ITokenRotationCachePayload>(`${BLACKLIST_KEY}:${user.sub}`);
    if (payload != undefined && payload.jti === user.jti) throw new UnauthorizedException();

    req.user = user;
    return true;
  }

  private async verifyRefresh(token: string, req: Request): Promise<boolean> {
    const session = await this.jwt.verifyAsync<JwtRefreshPayload>(token, {
      secret: this.config.getOrThrow("JWT_REFRESH_SECRET"),
      issuer: "backend:revenger",
      audience: "backend:revenger",
    });

    const payload = await this.cache.get<ITokenRotationCachePayload>(`${FAMILY_KEY}:${session.familyId}`);
    if (!payload) throw new UnauthorizedException();

    if (!payload || !session) {
      throw new UnauthorizedException();
    }

    console.log(session.exp * 1000 - Date.now());
    if (payload.jti !== session.jti || payload.revoked) {
      await this.cache.set<ITokenRotationCachePayload>(
        `${FAMILY_KEY}:${session.familyId}`,
        {
          jti: payload.jti,
          revoked: true,
        },
        session.exp * 1000 - Date.now(),
      );

      throw new UnauthorizedException();
    }

    req.session = session;

    return true;
  }
}
