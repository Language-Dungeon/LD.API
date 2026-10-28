import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { HydratedDocument } from "mongoose";

export interface ICharacterAttributes {
  user_id: string;
  name: string;
}

@Schema()
export class Character implements ICharacterAttributes {
  @Prop({ required: true, unique: true, type: mongoose.Schema.Types.String })
  user_id!: string;

  @Prop({ required: true, type: mongoose.Schema.Types.String })
  name!: string;
}

export type CharacterDocument = HydratedDocument<Character>;
export const CharacterSchema = SchemaFactory.createForClass(Character);
