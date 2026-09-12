import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";
import { isPublic } from "@common";

@isPublic()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
