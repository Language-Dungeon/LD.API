import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { Type } from "class-transformer";
import { AI_CEFR_LEVELS, type AiCefrLevel } from "../../profile/ai-level.types";
import { AI_EMBED_KINDS, type AiEmbedKind } from "../../embeds/ai-embed.repository";

const ID_MAX_LENGTH = 64;
const QUESTION_MAX_LENGTH = 8000;
const TEXT_MAX_LENGTH = 4000;

export class AiCompleteDTO {
  @IsString()
  @MinLength(1)
  @MaxLength(QUESTION_MAX_LENGTH)
  question!: string;

  @IsOptional()
  @IsString()
  @MaxLength(ID_MAX_LENGTH)
  threadId?: string;

  @IsOptional()
  @IsBoolean()
  withEmbeds?: boolean;
}

export class AiStreamDTO extends AiCompleteDTO {}

export class AiEmbedTextDTO {
  @IsString()
  @MinLength(1)
  @MaxLength(TEXT_MAX_LENGTH)
  text!: string;
}

export class AiSetLevelDTO {
  @IsIn(AI_CEFR_LEVELS)
  level!: AiCefrLevel;
}

export class AiSetGoalsDTO {
  @IsArray()
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  goals!: string[];
}

export class AiEmbedEventDTO {
  @IsString()
  @MinLength(1)
  @MaxLength(ID_MAX_LENGTH)
  type!: string;

  @IsOptional()
  payload?: Record<string, unknown>;
}

export class AiCreateEmbedDTO {
  @IsString()
  @MinLength(1)
  @MaxLength(ID_MAX_LENGTH)
  threadId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(ID_MAX_LENGTH)
  messageId!: string;

  @IsIn(AI_EMBED_KINDS)
  kind!: AiEmbedKind;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  props!: Record<string, unknown>;
}

export class AiListThreadsDTO {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class AiDiagnosticsDTO {
  @IsOptional()
  @IsBoolean()
  probe?: boolean;
}
