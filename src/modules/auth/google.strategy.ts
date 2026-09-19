import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { JwtPayload, type Config } from "@types";
import { Strategy, Profile, VerifyCallback } from "passport-google-oauth20";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(private readonly config: ConfigService<Config>) {
    super({
      clientID: config.getOrThrow("GOOGLE_CLIENT_ID"),
      clientSecret: config.getOrThrow("GOOGLE_CLIENT_SECRET"),
      callbackURL: config.getOrThrow("GOOGLE_REDIRECT_URI"),
      passReqToCallback: false,
      scope: ["email", "profile"],
    });
  }

  validate(_accessToken: string, _refreshToken: string, profile: Profile, done: VerifyCallback) {
    return done(null, profile as unknown as JwtPayload); //zeby nie nakurwialo type errorem
  }
}
