import { IsString, MaxLength, MinLength } from "class-validator";

export class ApplyOTP_DTO {
  @IsString()
  @MinLength(6)
  @MaxLength(7)
  otp!: string;
}
