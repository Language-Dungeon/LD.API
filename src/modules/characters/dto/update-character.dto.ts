import { PartialType } from "@nestjs/mapped-types";
import { CharacterDTO } from "./character.dto";

export class UpdateCharacterDTO extends PartialType(CharacterDTO) {}
