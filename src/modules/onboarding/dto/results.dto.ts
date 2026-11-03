import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsNotEmpty, ValidateNested } from "class-validator";
import { OPTION_IDS, QUESTION_IDS, OptionId, QuestionId } from "@types";

class ResultDTO {
  @IsIn(QUESTION_IDS)
  @IsNotEmpty()
  questionId!: QuestionId;

  @IsIn(OPTION_IDS)
  @IsNotEmpty()
  optionId!: OptionId;
}

export class UploadResultsDto {
  @IsArray()
  @IsNotEmpty()
  @ArrayMinSize(QUESTION_IDS.length)
  @ArrayMaxSize(QUESTION_IDS.length)
  @ArrayUnique((r: ResultDTO) => r.questionId)
  @ValidateNested({ each: true })
  @Type(() => ResultDTO)
  results!: ResultDTO[];
}
