import { IsString, IsNotEmpty, IsEmail, MinLength, IsBoolean, IsDate } from "class-validator";
import { IUserAttributes } from "../../../schemas/user";
import { Exclude } from "class-transformer";

export class UserDTO implements IUserAttributes {
  @IsBoolean()
  activated!: boolean;

  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @Exclude()
  password!: string;

  @IsDate()
  createdAt!: Date;

  @IsDate()
  updatedAt!: Date;
}
