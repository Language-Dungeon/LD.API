export const QUEUE_NAMES = {
  SEND_EMAIL: "user.send-otp",
  FORGOT_PASSWORD: "user.forgot-password",
} as const;

export interface IQueueEvents {
  SEND_EMAIL: { name: typeof QUEUE_NAMES.SEND_EMAIL; payload: { email: string } };
  FORGOT_PASSWORD: { name: typeof QUEUE_NAMES.FORGOT_PASSWORD; payload: { email: string } };
}
export type QueueNames = keyof IQueueEvents;
export type QueueName<T extends QueueNames> = IQueueEvents[T]["name"];
export type QueuePayload<T extends QueueNames> = IQueueEvents[T]["payload"];

export interface IBullMqEvent<T extends QueueNames> {
  readonly name: QueueName<T>;
  readonly payload: QueuePayload<T>;
}
