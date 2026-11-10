import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { AI_CEFR_LEVELS, AI_EMBED_KINDS, type AiCefrLevel, type AiEmbedKind } from "@types";

export class AiCompleteDTO {
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  question!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  threadId?: string;

  @IsOptional()
  @IsBoolean()
  withEmbeds?: boolean;
}

export class AiStreamDTO extends AiCompleteDTO {}

export class AiEmbedTextDTO {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text!: string;
}

export class AiSetLevelDTO {
  @IsIn(AI_CEFR_LEVELS)
  level!: AiCefrLevel;
}

export class AiSetGoalsDTO {
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  goals!: string[];
}

export class AiEmbedEventDTO {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  type!: string;

  @IsOptional()
  payload?: Record<string, unknown>;
}

export class AiCreateEmbedDTO {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  threadId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
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
  limit?: number;
}
