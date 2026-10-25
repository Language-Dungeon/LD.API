import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";
import { ApplyOTP_DTO } from "./apply-otp.dto";

export class ForgotPasswordDTO {
  @IsString()
  @IsEmail()
  email!: string;
}

export class ApplyForgotPasswordOTP_DTO extends ApplyOTP_DTO {
  @IsString()
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(20)
  password!: string;
}
