import { EXPIRES_IN_10MINS, EXPIRES_IN_7_DAYS, JwtPayload, JwtRefreshPayload, ROUTES } from "@types";
import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from "@nestjs/common";
import { CurrentSession, CurrentUser, GoogleGuard, SkipRefreshRoute } from "@common";
import { CreateUserDto } from "@modules/users/dto";
import { UserLoginDTO } from "./dto/login.dto";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { Public } from "@common";
import { ForgotPasswordDTO } from "./dto/forgot-password.dto";

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
        sameSite: "lax",
        expires: new Date(now + EXPIRES_IN_10MINS * 1000), //10min
      })
      .cookie("refresh_token", refresh, {
        signed: true,
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        expires: new Date(now + EXPIRES_IN_7_DAYS * 1000), //7dni
      });
  }
  @Public()
  @Post(ROUTES.AUTH.REGISTER)
  @HttpCode(201)
  async register(@Body() body: CreateUserDto) {
    return await this.auth.register(body);
  }

  @Public()
  @Get(ROUTES.AUTH.GOOGLE)
  @UseGuards(GoogleGuard)
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async google() {}

  @Public()
  @UseGuards(GoogleGuard)
  @Get(ROUTES.AUTH.GOOGLE_CALLBACK)
  async callback(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { access, refresh } = await this.auth.loginGoogle(req);
    const now = Date.now();

    return res
      .cookie("access_token", access, {
        signed: true,
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        expires: new Date(now + EXPIRES_IN_10MINS * 1000), //10min
      })
      .cookie("refresh_token", refresh, {
        signed: true,
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        expires: new Date(now + EXPIRES_IN_7_DAYS * 1000), //7dni
      })
      .redirect("http://localhost:3000/auth/me");
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
        sameSite: "lax",
        expires: new Date(now + EXPIRES_IN_10MINS * 1000), //10min
      })
      .cookie("refresh_token", refresh, {
        signed: true,
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        expires: new Date(now + EXPIRES_IN_7_DAYS * 1000), //7dni
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

  @Public()
  @Post(ROUTES.AUTH.FORGOT_PASSWORD)
  @HttpCode(200)
  async forgotPassword(@Body() body: ForgotPasswordDTO) {
    await this.auth.forgot(body);
  }
}
