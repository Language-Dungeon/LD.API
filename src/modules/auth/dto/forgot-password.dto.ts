import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class ForgotPasswordDTO {
  @IsString()
  @IsEmail()
  @MinLength(3)
  @MaxLength(20)
  email!: string;
}
