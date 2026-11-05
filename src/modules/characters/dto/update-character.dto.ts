import { PartialType } from "@nestjs/mapped-types";
import { CharacterDTO } from "./character.dto";
import { IsNotEmpty, IsString } from "class-validator";

export class UpdateCharacterDTO extends PartialType(CharacterDTO) {
  @IsString()
  @IsNotEmpty()
  characterId!: string;
}
