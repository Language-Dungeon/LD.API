import { CharacterAbilities, ICharacterAttributes } from "@schemas/character";
import { IsNotEmpty, IsObject, IsString } from "class-validator";

export class CharacterDTO implements ICharacterAttributes {
  @IsString()
  @IsNotEmpty()
  user_id!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsObject()
  attributes!: CharacterAbilities;
}

export class FetchCharacterDTO {
  @IsString()
  @IsNotEmpty()
  characterId!: string;
}
