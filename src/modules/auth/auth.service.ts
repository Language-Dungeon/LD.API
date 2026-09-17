import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { UserLoginDTO } from "./dto/login";
import { Cache } from "@nestjs/cache-manager";
import { plainToInstance } from "class-transformer";
import { CreateUserDto } from "@modules/users/dto/create-user.dto";
import { UserDTO } from "@modules/users/dto/user.dto";
import { CryptoService } from "@modules/crypto";
import { UsersService } from "@modules/users";
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

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService<Config>,
    private readonly jwt: JwtService,
    private readonly cache: Cache,
    private readonly crypto: CryptoService,
    private readonly user: UsersService,
  ) {}

  async login(body: UserLoginDTO) {
    const user = await this.user.findOneByEmail(body.email);
    console.log(body.email, this.crypto.encrypt_hmac(body.email));
    if (!user) throw new NotFoundException();
    if (!(await this.crypto.verifyHash(user.password, body.password))) throw new UnauthorizedException();

    const access = await this.generateAuthJwt({
      sub: user.id,
      email: user.email,
      username: user.username,
      activated: user.activated,
      role: user.role,
      permissions_overrides: user.permissions_overrides ?? undefined,
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

    const payload: CreateUserDto = {
      username: body.username,
      email: body.email,
      password: body.password,
    };

    const user = await this.user.create(payload);
    return plainToInstance(UserDTO, user, { excludeExtraneousValues: true });
  }

  /**
   * @author przdev7
   *
   *
   * @description
   * Refresh nie tworzy nowych danych
   * przekazuje te same dane w tym familyId i ten sam payload do nowych tokenow
   */

  async refresh(session: JwtRefreshPayload) {
    const user = await this.user.findOne(session.sub);
    if (!user) throw new UnauthorizedException();

    const { id, username, email, activated, role, permissions_overrides } = user;
    const { sub, familyId } = session;

    return {
      access: await this.generateAuthJwt({ sub: id, email, username, activated, role, permissions_overrides }),
      refresh: await this.generateRefreshJwt({ sub, familyId }),
    };
  }

  /**
   * @author przdev7
   *
   *
   * @description
   * Deautoryzacja tokenu o opiera sie o JWTID refresh tokena,
   * JWTID trafia do cache'u w ktorym jest do wygasniecia jego waznosci
   * Auth Guard sprawdza blacklist przy kazdym zapytaniu do zabezpieczonego endpointu
   */
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

  /**
   * @author przdev7
   *
   *
   * @description
   * Podczas tworzenia access tokenu
   * generowany jest unikalny id (JWTID) ktory pomaga zidentyfikowac request,
   * token jest wazny przez 10min
   */
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

  /**
   * @author przdev7
   *
   *
   * @description
   * Podczas logowania jest generowany "familyId",
   * familyId jest UUID ktore reprezentuje dana sesje urzadzenia,
   * familyId jest ustawiane jak KEY i trafia do cache'u do redisa
   * wraz z JWTID oraz inforamacja czy token jest dezaktywowany
   */
  private async generateRefreshJwt(payload: JwtRefreshRawPayload): Promise<string> {
    const jti = crypto.randomUUID();
    const token = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow("JWT_REFRESH_SECRET"),
      issuer: "backend:revenger",
      audience: "backend:revenger",
      jwtid: jti,
      expiresIn: EXPIRES_IN_7_DAYS,
    });

    //dodaje JWTID i familyId na 7 dni do cachea
    await this.cache.set<ITokenRotationCachePayload>(
      `${FAMILY_KEY}:${payload.familyId}`,
      { jti: jti, revoked: false },
      EXPIRES_IN_7_DAYS * 1000,
    );
    return token;
  }
}
