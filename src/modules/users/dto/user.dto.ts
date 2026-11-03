import { IsString, IsNotEmpty, IsEmail, MinLength, IsBoolean, IsDate, IsObject, IsArray } from "class-validator";
import { IUserAttributes, OnBoarding } from "../../../schemas/user";
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

  @IsArray()
  onboarding?: OnBoarding[] | undefined;

  @IsDate()
  createdAt!: Date;

  @IsDate()
  updatedAt!: Date;
}
