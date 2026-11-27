import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { OnboardingService } from "./onboarding.service";
import { UploadResultsDto } from "./dto/results.dto";
import { CurrentUser, Public } from "@common";
import { IAuthUser, ROUTES } from "@types";

@Controller(ROUTES.ONBOARDING.BASE)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Public()
  @Get(ROUTES.ONBOARDING.GET_QUESTIONS_DATA)
  async getOnBoardingQuestionsData() {
    return this.onboarding.getOnBoardingQuestionsData();
  }

  @Post(ROUTES.ONBOARDING.UPLOAD_RESULTS)
  @HttpCode(200)
  async uploadOnBooardingResults(@CurrentUser() user: IAuthUser, @Body() body: UploadResultsDto): Promise<void> {
    return await this.onboarding.uploadOnBoarding(user, body);
  }
}
