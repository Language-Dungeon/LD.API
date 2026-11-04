import { IsString, IsNotEmpty, MinLength, MaxLength } from "class-validator";

export class CreateCharacterDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(16)
  name!: string;
}
