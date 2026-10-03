import type { IBullMqEvent, QueuePayload } from "@types";

export class SendOTPEmailEvent implements IBullMqEvent<"SEND_OTP"> {
  readonly name = "email.send-otp" as const;
  readonly payload: QueuePayload<"SEND_OTP">;

  constructor(payload: QueuePayload<"SEND_OTP">) {
    this.payload = payload;
  }
}
