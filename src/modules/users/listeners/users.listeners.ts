import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { QUEUE_NAMES } from "@types";
import { Queue } from "bullmq";

@Injectable()
export class UsersListener {
  constructor(@InjectQueue(QUEUE_NAMES.SEND_EMAIL) private readonly queue: Queue) {}
}
