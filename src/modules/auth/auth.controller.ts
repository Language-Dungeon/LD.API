import { Body, Controller, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { UserLoginDTO } from "./dto/login";

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
        expires: new Date(now + 300 * 1000), //5mins
      })
      .cookie("refresh_token", refresh, {
        signed: true,
        httpOnly: true,
        secure: true,
        sameSite: true,
        expires: new Date(now + 604800 * 1000), //7days
      });

    res.redirect("http://localhost:3000/dashboard");
  }
}
