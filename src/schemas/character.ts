import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { HydratedDocument } from "mongoose";

export interface ICharacterAttributes {
  user_id: string;
  name: string;
  attributes: CharacterAbilities;
}

export interface IAttributes {
  cha: number;
  con: number;
  dex: number;
  intel: number;
  wis: number;
}

@Schema({ _id: false })
export class CharacterAbilities implements IAttributes {
  @Prop({ required: true, type: Number, min: 1, max: 30, default: 1 })
  cha!: number;

  @Prop({ required: true, type: Number, min: 1, max: 30, default: 1 })
  con!: number;

  @Prop({ required: true, type: Number, min: 1, max: 30, default: 1 })
  dex!: number;

  @Prop({ required: true, type: Number, min: 1, max: 30, default: 1 })
  intel!: number;

  @Prop({ required: true, type: Number, min: 1, max: 30, default: 1 })
  wis!: number;
}

const CharacterAbilitiesSchema = SchemaFactory.createForClass(CharacterAbilities);

@Schema({ timestamps: true })
export class Character implements ICharacterAttributes {
  @Prop({ required: true, unique: false, type: mongoose.Schema.Types.String })
  user_id!: string;

  @Prop({ required: true, type: mongoose.Schema.Types.String })
  name!: string;

  @Prop({ required: true, type: CharacterAbilitiesSchema, default: () => ({}) })
  attributes!: CharacterAbilities;
}

export type CharacterDocument = HydratedDocument<Character>;
export const CharacterSchema = SchemaFactory.createForClass(Character);
