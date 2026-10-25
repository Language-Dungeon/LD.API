import { IsString, MaxLength, MinLength } from "class-validator";

export class ChangePasswordDTO {
  @IsString()
  oldPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(20)
  newPassword!: string;
}
