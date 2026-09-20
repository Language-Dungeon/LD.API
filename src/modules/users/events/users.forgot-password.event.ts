import type { IBullMqEvent, QueuePayload } from "@types";

export class ForgotPasswordEvent implements IBullMqEvent<"FORGOT_PASSWORD"> {
  readonly name = "user.forgot-password" as const;
  readonly payload: QueuePayload<"FORGOT_PASSWORD">;

  constructor(payload: QueuePayload<"FORGOT_PASSWORD">) {
    this.payload = payload;
  }
}
