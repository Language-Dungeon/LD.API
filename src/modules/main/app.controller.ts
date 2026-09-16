import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";
import { Public } from "@common";
import { ROUTES } from "@types";

@Public()
@Controller(ROUTES.MAIN.BASE)
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
