import { Injectable } from "@nestjs/common";
import { JwtPayload, onBoardingData } from "@types";
import { UploadResultsDto } from "./dto/results.dto";
import { OnBoarding } from "@schemas/user";
import { UsersService } from "@modules/users";

@Injectable()
export class OnboardingService {
  constructor(private readonly users: UsersService) {}
  getOnBoardingQuestionsData() {
    return onBoardingData;
  }

  async uploadOnBoarding(user: JwtPayload, body: UploadResultsDto): Promise<void> {
    const onboarding: OnBoarding[] = [];
    for (const obj of body.results) {
      onboarding.push({ questionId: obj.questionId, answerId: obj.optionId });
    }

    await this.users.update(user.sub, { onboarding: onboarding });

    return;
  }
}
