import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Config } from "@types";
import { Resend } from "resend";

@Injectable()
export class MailerService extends Resend {
  constructor(private readonly config: ConfigService<Config>) {
    super(config.getOrThrow("RESEND_API_KEY"));
  }
}
