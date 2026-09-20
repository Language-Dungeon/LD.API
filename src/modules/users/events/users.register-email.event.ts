import type { IBullMqEvent, QueuePayload } from "@types";

export class SendRegisterEmailEvent implements IBullMqEvent<"SEND_EMAIL"> {
  readonly name = "user.send-otp" as const;
  readonly payload: QueuePayload<"SEND_EMAIL">;

  constructor(payload: QueuePayload<"SEND_EMAIL">) {
    this.payload = payload;
  }
}
