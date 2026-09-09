import { Body, Controller, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { UserLoginDTO } from "./dto/login";
import { CurrentSession, CurrentUser } from "@common";
import { EXPIRES_IN_10MINS, EXPIRES_IN_7_DAYS, JwtPayload, JwtRefreshPayload } from "@types";
import { CreateUserDto } from "@modules/users/dto/create-user.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  async login(@Res({ passthrough: true }) res: Response, @Body() body: UserLoginDTO) {
    console.log(body);
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

  @Post("refresh")
  async refresh(@CurrentSession() session: JwtRefreshPayload, @Res({ passthrough: true }) res: Response) {
    const { access, refresh } = await this.auth.refresh(session);
    const now = Date.now();

    res
      .cookie("access_token", access, {
        signed: true,
        httpOnly: true,
        secure: true,
        sameSite: true,
        expires: new Date(now + 300 * 1000), //5mins
      })
      .cookie("refresh_token", refresh, {
        signed: true,
        httpOnly: true,
        secure: true,
        sameSite: true,
        expires: new Date(now + 604800 * 1000), //7days
      })
      .status(200)
      .send();
  }

  @Post("logout")
  async logout(@CurrentUser() user: JwtPayload, @CurrentSession() session: JwtRefreshPayload, @Res() res: Response) {
    await this.auth.logout(user, session);
    return res.status(200).send();
  }
}
