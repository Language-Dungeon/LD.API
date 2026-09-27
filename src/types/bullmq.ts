export const QUEUES_NAMES = {
  EMAIL: "email",
};

export const QUEUES_EVENTS = {
  SEND_OTP: "email.send-otp",
  NOTIFCATION: "email.send-notifcation",
  FORGOT_PASSWORD: "email.forgot-password",
} as const;

export interface IQueueEvents {
  SEND_OTP: { name: typeof QUEUES_EVENTS.SEND_OTP; payload: { email: string } };
  NOTIFICATION: { name: typeof QUEUES_EVENTS.NOTIFCATION; payload: { email: string; message: string } };
  FORGOT_PASSWORD: { name: typeof QUEUES_EVENTS.FORGOT_PASSWORD; payload: { email: string; message: string } };
}
export type QueueEventsType = { [K in keyof IQueueEvents]: IQueueEvents[K] }[keyof IQueueEvents];

export type QueueNames = keyof IQueueEvents;
export type QueueName<T extends QueueNames> = IQueueEvents[T]["name"];
export type QueuePayload<T extends QueueNames> = IQueueEvents[T]["payload"];

export interface IBullMqEvent<T extends QueueNames> {
  readonly name: QueueName<T>;
  readonly payload: QueuePayload<T>;
}
