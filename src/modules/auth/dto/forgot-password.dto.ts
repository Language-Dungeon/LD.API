import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";
import { ApplyOTP_DTO } from "./apply-otp.dto";

export class ForgotPasswordDTO {
  @IsString()
  @IsEmail()
  @MinLength(3)
  @MaxLength(20)
  email!: string;
}

export class ApplyForgotPasswordOTP_DTO extends ApplyOTP_DTO {
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  password!: string;
}
