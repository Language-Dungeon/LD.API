import { CharactersService } from "@modules/characters/characters.service";
import { UsersService } from "@modules/users";
import { CanActivate, ExecutionContext, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

@Injectable()
export class CharacterGuard implements CanActivate {
  constructor(
    private readonly user: UsersService,
    private readonly character: CharactersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    if (!req.user) throw new UnauthorizedException();

    const dbUser = await this.user.findOne(req.user.id);
    if (!dbUser) throw new UnauthorizedException();

    const characterId: string = req.body["characterId"];
    if (!characterId) return true;

    const character = await this.character.findOne(characterId);

    if (!character) throw new NotFoundException();
    if (character.user_id !== dbUser._id.toString()) throw new UnauthorizedException();

    return true;
  }
}
