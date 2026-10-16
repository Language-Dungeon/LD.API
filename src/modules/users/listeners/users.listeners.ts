import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { QUEUES_NAMES } from "@types";
import { Queue } from "bullmq";
import { ForgotPasswordEvent, SendOTPEmailEvent } from "../events";

const JOB_OPTIONS = {
  attemps: 3,
  backoff: {
    type: "exponential" as const,
    delay: 1000,
  },
} as const;

@Injectable()
export class UsersListener {
  constructor(@InjectQueue(QUEUES_NAMES.EMAIL) private readonly emailQueue: Queue) {}

  @OnEvent(SendOTPEmailEvent.name)
  async handleSendOTPEmail(event: SendOTPEmailEvent) {
    await this.emailQueue.add(event.name, event.payload, JOB_OPTIONS);
  }

  @OnEvent(ForgotPasswordEvent.name)
  async handleForgotPasswrd(event: ForgotPasswordEvent) {
    await this.emailQueue.add(event.name, event.payload, JOB_OPTIONS);
  }
}
