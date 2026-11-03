import { Module } from "@nestjs/common";
import { CharactersService } from "./characters.service";
import { CharactersController } from "./characters.controller";
import { MongooseModule } from "@nestjs/mongoose";
import { Character, CharacterSchema } from "@schemas/character";

@Module({
  imports: [MongooseModule.forFeature([{ name: Character.name, schema: CharacterSchema }])],
  providers: [CharactersService],
  controllers: [CharactersController],
})
export class CharactersModule {}
