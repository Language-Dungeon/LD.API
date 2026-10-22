import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { UserLoginDTO } from "./dto/login.dto";
import { Cache } from "@nestjs/cache-manager";
import { plainToInstance } from "class-transformer";
import { UserDTO, CreateUserDto } from "@modules/users/dto";
import { CryptoService } from "@modules/crypto";
import { UsersService } from "@modules/users";
import type { Request } from "express";

import {
  type JwtRawPayload,
  BLACKLIST_KEY,
  Config,
  EXPIRES_IN_10MINS,
  EXPIRES_IN_7_DAYS,
  FAMILY_KEY,
  ITokenRotationCachePayload,
  IUserOTPCachePayload,
  JwtPayload,
  JwtRefreshPayload,
  JwtRefreshRawPayload,
  OTP_KEY,
} from "@types";
import { Profile } from "passport-google-oauth20";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService<Config>,
    private readonly jwt: JwtService,
    private readonly cache: Cache,
    private readonly crypto: CryptoService,
    private readonly user: UsersService,
    private readonly emitter: EventEmitter2,
  ) {}

  //TODO: Add finding by username
  async login(body: UserLoginDTO) {
    const user = await this.user.findOneByEmail(body.email);
    if (!user) throw new NotFoundException();

    if (!user.password) throw new UnauthorizedException("please use google login");
    if (!(await this.crypto.verifyHash(user.password, body.password))) throw new UnauthorizedException();
    const decryptedEmail = await this.crypto.decrypt(user.email);

    const access = await this.generateAuthJwt({
      sub: user.id,
      email: decryptedEmail,
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

  async register(body: CreateUserDto) {
    const existingUser = await this.user.findOneByEmail(body.email);
    if (existingUser) throw new ConflictException();

    const user = await this.user.create(body.email, body.username, body.password);
    return plainToInstance(UserDTO, user, { excludeExtraneousValues: true });
  }

  /**
   * @author przdev7
   *
   * @description
   * Tworzy nowego usera (gdy nie ma go jeszcze w bazie) i jednoczesnie loguje juz istniejacych uzytkownikow
   */
  async loginGoogle(req: Request) {
    const profile = req.user as unknown as Profile;
    const emails = profile.emails;
    if (emails === undefined || emails[0] === undefined)
      throw new InternalServerErrorException("Not found email for this account, please contact support");

    const mainEmail = emails[0].value;
    const user = await this.user.findOneByEmailAndUpdate(mainEmail, { username: profile.displayName });

    if (user) {
      const access = await this.generateAuthJwt({
        sub: user.id,
        email: mainEmail,
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

    const createdUser = await this.user.create(mainEmail, profile.displayName, null);
    const access = await this.generateAuthJwt({
      sub: createdUser.id,
      email: mainEmail,
      username: createdUser.username,
      activated: createdUser.activated,
      role: createdUser.role,
      permissions_overrides: createdUser.permissions_overrides ?? undefined,
    });

    const refresh = await this.generateRefreshJwt({
      sub: createdUser.id,
      familyId: crypto.randomUUID(),
    });

    return { access, refresh };
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
    const decryptedEmail = await this.crypto.decrypt(email);

    return {
      access: await this.generateAuthJwt({
        sub: id,
        email: decryptedEmail,
        username,
        activated,
        role,
        permissions_overrides,
      }),
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
      issuer: "LD.API",
      audience: "LD.API",
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
      issuer: "LD.API",
      audience: "LD.API",
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

  async applyOTP(user: JwtPayload, otp: string): Promise<boolean> {
    const payload = await this.cache.get<IUserOTPCachePayload>(`${OTP_KEY}:${user.email}`);
    if (!payload || payload.otp != otp || user.activated) throw new BadRequestException();

    await this.cache.del(`${OTP_KEY}:${user.email}`);
    await this.user.update(user.sub, { activated: true });

    return true;
  }

  async userExists(email: string): Promise<boolean> {
    return (await this.user.findOneByEmail(email)) === null ? false : true;
  }
}
