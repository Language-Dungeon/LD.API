import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Character, CharacterDocument } from "@schemas/character";
import { Model } from "mongoose";
import { CreateCharacterDto, UpdateCharacterDTO } from "./dto";

@Injectable()
export class CharactersService {
  constructor(@InjectModel(Character.name) private readonly character: Model<Character>) {}

  async create(userId: string, body: CreateCharacterDto) {
    await this.character.create({ user_id: userId, name: body.name });
  }

  async findOneByPk(characterId: string): Promise<CharacterDocument | null> {
    return await this.character.findById(characterId);
  }

  async findAllByUserId(userId: string): Promise<CharacterDocument[]> {
    return await this.character.find({ user_id: userId });
  }

  async update(characterId: string, body: UpdateCharacterDTO): Promise<CharacterDocument | null> {
    return await this.character.findByIdAndUpdate(characterId, body);
  }

  async remove(characterId: string): Promise<CharacterDocument | null> {
    return await this.character.findByIdAndDelete(characterId);
  }
}
