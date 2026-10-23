import { CryptoService } from "@modules/crypto";
import { LoggerService } from "@modules/logger";
import { MailerService, OTPEmail } from "@modules/mailer";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Cache } from "@nestjs/cache-manager";
import { Injectable } from "@nestjs/common";
import { EXPIRES_IN_10MINS, IUserOTPCachePayload, OTP_KEY, QueueEventsType, QUEUES_EVENTS, QUEUES_NAMES } from "@types";
import { Job } from "bullmq";
import { jsx } from "react/jsx-runtime";

@Injectable()
@Processor(QUEUES_NAMES.EMAIL)
export class UsersEmailProcessor extends WorkerHost {
  constructor(
    private readonly logger: LoggerService,
    private readonly mailer: MailerService,
    private readonly crypto: CryptoService,
    private readonly cache: Cache,
  ) {
    super();
  }

  async process(job: Job<QueueEventsType["payload"], QueueEventsType["name"]>): Promise<void> {
    const event = { name: job.name, payload: job.data } as QueueEventsType;

    switch (event.name) {
      case QUEUES_EVENTS.SEND_OTP: {
        const otp = this.crypto.generate_otp();

        await this.mailer.emails.send({
          from: `Resend <onboarding@resend.dev>`,
          to: event.payload.email,
          subject: "Language Dangeon account activation code",
          react: jsx(OTPEmail, { otp }),
        });
        await this.cache.set<IUserOTPCachePayload>(
          `${OTP_KEY}:${event.payload.email}`,
          { otp },
          EXPIRES_IN_10MINS * 1000,
        );

        break;
      }
      case QUEUES_EVENTS.NOTIFCATION: {
        this.logger.log("notification");
        break;
      }
      case QUEUES_EVENTS.FORGOT_PASSWORD: {
        this.logger.log("forgot password");
        break;
      }
      default: {
        this.logger.error(`Unknown job: ${job.name}, ${JSON.stringify(job)}`);
      }
    }
  }
}
