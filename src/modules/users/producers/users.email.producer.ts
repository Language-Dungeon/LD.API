import { CryptoService } from "@modules/crypto";
import { LoggerService } from "@modules/logger";
import { MailerService, OTPEmail } from "@modules/mailer";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { QueueEventsType, QUEUES_EVENTS, QUEUES_NAMES } from "@types";
import { Job } from "bullmq";
import { jsx } from "react/jsx-runtime";

@Injectable()
@Processor(QUEUES_NAMES.EMAIL)
export class UsersEmailProcessor extends WorkerHost {
  constructor(
    private readonly logger: LoggerService,
    private readonly mailer: MailerService,
    private readonly crypto: CryptoService,
  ) {
    super();
  }

  async process(job: Job<QueueEventsType["payload"], QueueEventsType["name"]>): Promise<void> {
    const event = { name: job.name, payload: job.data } as QueueEventsType;

    switch (event.name) {
      case QUEUES_EVENTS.SEND_OTP: {
        await this.mailer.emails.send({
          from: `Resend <onboarding@resend.dev>`,
          to: event.payload.email,
          subject: "Language Dangeon account activation code",
          react: jsx(OTPEmail, { otp: this.crypto.generate_otp() }),
        });
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
