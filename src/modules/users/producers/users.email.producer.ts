import { LoggerService } from "@modules/logger";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { QUEUES_EVENTS, QUEUES_NAMES } from "@types";
import { Job } from "bullmq";

@Injectable()
@Processor(QUEUES_NAMES.EMAIL)
export class UsersEmailProcessor extends WorkerHost {
  constructor(private readonly logger: LoggerService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case QUEUES_EVENTS.SEND_OTP: {
        this.logger.log("send otp");
        break;
      }
    }
  }
}
