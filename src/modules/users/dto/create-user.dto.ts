import { Exclude } from "class-transformer";
import { IsString, IsNotEmpty, IsEmail, MinLength } from "class-validator";

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @Exclude()
  password!: string;
}
