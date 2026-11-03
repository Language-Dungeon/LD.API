import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Character } from "@schemas/character";
import { Model } from "mongoose";
import { CreateCharacterDto } from "./dto/create-character.dto";

@Injectable()
export class CharactersService {
  constructor(@InjectModel(Character.name) private readonly character: Model<Character>) {}

  async create(userId: string, body: CreateCharacterDto) {
    await this.character.create({ language: body.language });
  }
}
