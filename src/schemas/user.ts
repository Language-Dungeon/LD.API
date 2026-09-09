import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { HydratedDocument } from "mongoose";

export interface IUserAttributes {
  // id: string;
  username: string;
  email: string;
  password: string;
  activated: boolean;
}

@Schema()
export class User implements IUserAttributes {
  @Prop({ required: true, unique: true, type: mongoose.Schema.Types.ObjectId })
  id!: string;

  @Prop({ required: true, type: mongoose.Schema.Types.String })
  username!: string;

  @Prop({ required: true, unique: true, type: mongoose.Schema.Types.String })
  email!: string;

  @Prop({ required: true, type: mongoose.Schema.Types.String })
  password!: string;

  @Prop({ required: true, type: mongoose.Schema.Types.Boolean })
  activated!: boolean;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
