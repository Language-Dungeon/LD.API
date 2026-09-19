import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "../../schemas/user";
import { AuthType, AuthTypeSchema } from "../../schemas/authType";
import { LoggerModule } from "@modules/logger";

@Module({
  imports: [
    LoggerModule.register("Users"),
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
