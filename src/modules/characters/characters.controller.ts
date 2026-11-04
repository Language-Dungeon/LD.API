import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { JwtPayload, ROUTES } from "@types";
import { CharactersService } from "./characters.service";
import { CreateCharacterDto, UpdateCharacterDTO } from "./dto";
import { CurrentUser } from "@common/decorators";

@Controller(ROUTES.CHARACTER.BASE)
export class CharactersController {
  constructor(private readonly character: CharactersService) {}

  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() body: CreateCharacterDto) {
    return await this.character.create(user.sub, body);
  }

  @Get(ROUTES.CHARACTER.ALL)
  async findAll(@CurrentUser() user: JwtPayload) {
    return await this.character.findAllByUserId(user.sub);
  }

  @Get()
  async findOne(@CurrentUser() user: JwtPayload) {
    return await this.character.findAllByUserId(user.sub);
  }

  @Patch()
  update(@CurrentUser() user: JwtPayload, @Body() body: UpdateCharacterDTO) {
    return this.character.update(user.sub, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.character.remove(id);
  }
}
