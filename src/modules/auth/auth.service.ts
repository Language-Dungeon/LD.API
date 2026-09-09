import { UsersService } from "@modules/users/users.service";
import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { UserLoginDTO } from "./dto/login";
import { Cache } from "@nestjs/cache-manager";
import {
  type JwtRawPayload,
  BLACKLIST_KEY,
  Config,
  EXPIRES_IN_10MINS,
  EXPIRES_IN_7_DAYS,
  FAMILY_KEY,
  ITokenRotationCachePayload,
  JwtPayload,
  JwtRefreshPayload,
  JwtRefreshRawPayload,
} from "@types";
import { CreateUserDto } from "@modules/users/dto/create-user.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService<Config>,
    private readonly jwt: JwtService,
    private readonly cache: Cache,
    private readonly user: UsersService,
  ) {}

  async login(body: UserLoginDTO) {
    const user = await this.user.findOneByEmail(body.email);
    if (!user) throw new NotFoundException();

    const access = await this.generateAuthJwt({
      sub: user.id,
      email: user.email,
      username: user.username,
      activated: user.activated,
    });

    const refresh = await this.generateRefreshJwt({
      sub: user.id,
      familyId: crypto.randomUUID(),
    });

    return { access, refresh };
  }

  async signup(body: CreateUserDto) {
    const existingUser = await this.user.findOneByEmail(body.email);
    if (existingUser) throw new ConflictException();
  }

  async refresh(session: JwtRefreshPayload) {
    const user = await this.user.findOne(session.sub);
    if (!user) throw new UnauthorizedException();

    const { id, username, email, activated } = user;
    const { sub, familyId } = session;

    return {
      access: await this.generateAuthJwt({ sub: id, email, username, activated }),
      refresh: await this.generateRefreshJwt({ sub, familyId }),
    };
  }

  async logout(user: JwtPayload, session: JwtRefreshPayload) {
    await this.cache.set(`${BLACKLIST_KEY}:${user.sub}`, user.jti, user.exp * 1000 - Date.now());
    await this.cache.set<ITokenRotationCachePayload>(
      `${FAMILY_KEY}:${session.familyId}`,
      {
        jti: session.jti,
        revoked: true,
      },
      session.exp * 1000 - Date.now(),
    );
  }

  private async generateAuthJwt(payload: JwtRawPayload): Promise<string> {
    const jti = crypto.randomUUID();
    const token = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow("JWT_SECRET"),
      issuer: "backend:revenger",
      audience: "backend:revenger",
      jwtid: jti,
      expiresIn: EXPIRES_IN_10MINS,
    });

    return token;
  }

  private async generateRefreshJwt(payload: JwtRefreshRawPayload): Promise<string> {
    const jti = crypto.randomUUID();
    const token = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow("JWT_REFRESH_SECRET"),
      issuer: "backend:revenger",
      audience: "backend:revenger",
      jwtid: jti,
      expiresIn: EXPIRES_IN_7_DAYS,
    });

    await this.cache.set<ITokenRotationCachePayload>(`${FAMILY_KEY}:${payload.familyId}`, { jti: jti, revoked: false });
    return token;
  }
}
