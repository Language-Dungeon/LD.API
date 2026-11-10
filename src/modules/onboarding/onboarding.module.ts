import { Module } from "@nestjs/common";
import { OnboardingService } from "./onboarding.service";
import { OnboardingController } from "./onboarding.controller";
import { UsersModule } from "@modules/users";

@Module({
  imports: [UsersModule],
  providers: [OnboardingService],
  controllers: [OnboardingController],
})
export class OnboardingModule {}
