import { User, UserSchema, AuthType, AuthTypeSchema } from "@schemas";
import { UsersEmailProcessor } from "./producers/users.email.producer";
import { UsersListener } from "./listeners/users.listeners";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { MongooseModule } from "@nestjs/mongoose";
import { LoggerModule } from "@modules/logger";
import { MailerModule } from "@modules/mailer";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { QUEUES_NAMES } from "@types";
import { CryptoModule } from "@modules/crypto";

@Module({
  imports: [
    MailerModule,
    CryptoModule,
    LoggerModule.register("Users"),
    BullModule.registerQueue({ name: QUEUES_NAMES.EMAIL }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: AuthType.name, schema: AuthTypeSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersListener, UsersEmailProcessor],
  exports: [UsersService],
})
export class UsersModule {}
