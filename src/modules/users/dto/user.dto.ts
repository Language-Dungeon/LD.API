import { IsString, IsNotEmpty, IsEmail, MinLength, IsBoolean, IsDate, IsObject } from "class-validator";
import { IUserAttributes } from "../../../schemas/user";
import { Exclude } from "class-transformer";
import { PermissionValue, Roles } from "@types";

export class UserDTO implements IUserAttributes {
  @IsBoolean()
  activated!: boolean;

  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @Exclude()
  email_hmac!: string;

  @IsString()
  @MinLength(8)
  @Exclude()
  password!: string;

  @IsString()
  role!: Roles;

  @IsObject()
  permissions_overrides?: Record<PermissionValue, boolean> | undefined;

  @IsDate()
  createdAt!: Date;

  @IsDate()
  updatedAt!: Date;
}
