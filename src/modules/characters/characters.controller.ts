import { Body, Controller, Delete, Get, NotFoundException, Patch, Post } from "@nestjs/common";
import { JwtPayload, ROUTES } from "@types";
import { CharactersService } from "./characters.service";
import { CreateCharacterDto, FetchCharacterDTO, RemoveCharacterDTO, UpdateCharacterDTO } from "./dto";
import { CurrentUser } from "@common/decorators";
import { CharacterDocument } from "@schemas/character";

@Controller(ROUTES.CHARACTER.BASE)
export class CharactersController {
  constructor(private readonly character: CharactersService) {}

  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() body: CreateCharacterDto): Promise<CharacterDocument> {
    return await this.character.create(user.sub, body);
  }

  @Get(ROUTES.CHARACTER.ALL)
  async findAll(@CurrentUser() user: JwtPayload): Promise<CharacterDocument[]> {
    return await this.character.findAllByUserId(user.sub);
  }

  @Get()
  async findOne(@Body() body: FetchCharacterDTO): Promise<CharacterDocument> {
    const character = await this.character.findOneByPk(body.characterId);
    if (!character) throw new NotFoundException();

    return character;
  }

  /**
   *
   *  @todo validowac czy user posiada rzeczywiscie tego charactera
   * czyli zablokowac mozliwosc updateu nie swojego characteru
   *
   */
  @Patch()
  async update(@Body() body: UpdateCharacterDTO): Promise<CharacterDocument> {
    const character = await this.character.update(body.characterId, body);
    if (!character) throw new NotFoundException();

    return character;
  }

  @Delete()
  async remove(@CurrentUser() body: RemoveCharacterDTO): Promise<CharacterDocument> {
    const character = await this.character.remove(body.characterId);
    if (!character) throw new NotFoundException();

    return character;
  }
}
