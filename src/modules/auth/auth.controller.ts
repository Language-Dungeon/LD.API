import { Body, Controller, Get, HttpCode, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { UserLoginDTO } from "./dto/login";
import { CurrentSession, CurrentUser, SkipRefreshRoute } from "@common";
import { EXPIRES_IN_10MINS, EXPIRES_IN_7_DAYS, JwtPayload, JwtRefreshPayload, ROUTES } from "@types";
import { CreateUserDto } from "@modules/users/dto/create-user.dto";
import { Public } from "@common";

@Controller(ROUTES.AUTH.BASE)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post(ROUTES.AUTH.LOGIN)
  @HttpCode(200)
  async login(@Res({ passthrough: true }) res: Response, @Body() body: UserLoginDTO) {
    const { access, refresh } = await this.auth.login(body);
    const now = Date.now();

    res
      .cookie("access_token", access, {
        signed: true,
        httpOnly: true,
        secure: true,
        sameSite: true,
        expires: new Date(now + EXPIRES_IN_10MINS * 1000), //10mins
      })
      .cookie("refresh_token", refresh, {
        signed: true,
        httpOnly: true,
        secure: true,
        sameSite: true,
        expires: new Date(now + EXPIRES_IN_7_DAYS * 1000), //7days
      });
  }
  @Public()
  @Post(ROUTES.AUTH.REGISTER)
  @HttpCode(201)
  async signUp(@Body() body: CreateUserDto) {
    await this.auth.signup(body);
    return await this.auth.login(body);
  }

  @Post(ROUTES.AUTH.REFRESH)
  @SkipRefreshRoute()
  @HttpCode(200)
  async refresh(@CurrentSession() session: JwtRefreshPayload, @Res({ passthrough: true }) res: Response) {
    const { access, refresh } = await this.auth.refresh(session);
    const now = Date.now();

    res
      .cookie("access_token", access, {
        signed: true,
        httpOnly: true,
        secure: true,
        sameSite: true,
        expires: new Date(now + EXPIRES_IN_10MINS * 1000), //10mins
      })
      .cookie("refresh_token", refresh, {
        signed: true,
        httpOnly: true,
        secure: true,
        sameSite: true,
        expires: new Date(now + EXPIRES_IN_7_DAYS * 1000), //7days
      })
      .status(200)
      .send();
  }

  @Get(ROUTES.AUTH.ME)
  @HttpCode(200)
  async me(@CurrentUser() user: JwtPayload) {
    return user;
  }

  @Post(ROUTES.AUTH.LOGOUT)
  @HttpCode(200)
  async logout(@CurrentUser() user: JwtPayload, @CurrentSession() session: JwtRefreshPayload, @Res() res: Response) {
    await this.auth.logout(user, session);
    return res.status(200).send();
  }
}
