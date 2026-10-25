import { EXPIRES_IN_10MINS, EXPIRES_IN_7_DAYS, JwtPayload, JwtRefreshPayload, ROUTES } from "@types";
import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from "@nestjs/common";
import { CurrentSession, CurrentUser, GoogleGuard, SkipAccountActivated, SkipRefreshRoute } from "@common";
import { CreateUserDto } from "@modules/users/dto";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { Public } from "@common";
import { UserLoginDTO, ForgotPasswordDTO, ApplyForgotPasswordOTP_DTO, ApplyOTP_DTO, ChangePasswordDTO } from "./dto";

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
  @SkipAccountActivated()
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

  @Post(ROUTES.AUTH.GENERATE_OTP)
  @HttpCode(200)
  @SkipAccountActivated()
  async generateOTP(@CurrentUser() user: JwtPayload) {
    return await this.auth.generateOTP(user);
  }

  @Post(ROUTES.AUTH.APPLY_OTP)
  @SkipAccountActivated()
  @HttpCode(200)
  async applyOTP(@CurrentUser() user: JwtPayload, @Body() body: ApplyOTP_DTO) {
    return await this.auth.applyOTP(user, body.otp);
  }

  @Public()
  @Post(ROUTES.AUTH.FORGOT_PASSWORD)
  @HttpCode(200)
  async forgotPassword(@Body() body: ForgotPasswordDTO) {
    return await this.auth.forgotPassword(body);
  }

  @Public()
  @Post(ROUTES.AUTH.FORGOT_PASSWORD_APPLY_OTP)
  @HttpCode(200)
  async applyForgotPasswordOTP(@Body() body: ApplyForgotPasswordOTP_DTO) {
    return await this.auth.applyForgotPasswordOTP(body);
  }

  @Post(ROUTES.AUTH.CHANGE_PASSWORD)
  @HttpCode(200)
  async changePassword(@CurrentUser() user: JwtPayload, @Body() body: ChangePasswordDTO) {
    return await this.auth.changePassword(user, body);
  }
}
