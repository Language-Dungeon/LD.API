import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "../../schemas/user";
import { AuthType, AuthTypeSchema } from "../../schemas/auth-type";
import { LoggerModule } from "@modules/logger";
import { BullModule } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@types";

@Module({
  imports: [
    LoggerModule.register("Users"),
    BullModule.registerQueue({ name: QUEUE_NAMES.SEND_EMAIL }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: AuthType.name, schema: AuthTypeSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
