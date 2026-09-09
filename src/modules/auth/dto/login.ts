import { IsEmail, IsString, MaxLength, MinLength, ValidateIf } from "class-validator";

export class UserLoginDTO {
  @ValidateIf((o) => !o.username)
  @IsString()
  @IsEmail()
  @MinLength(3)
  @MaxLength(20)
  email!: string;

  @ValidateIf((o) => !o.email)
  @IsString()
  @MinLength(3)
  @MaxLength(16)
  username!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(20)
  password!: string;
}
