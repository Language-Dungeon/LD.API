import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { HydratedDocument } from "mongoose";

export interface IUserAttributes {
  // id: string;
  username: string;
  email: string;
  password: string;
  activated: boolean;
}

@Schema({ timestamps: true })
export class User implements IUserAttributes {
  @Prop({ required: true, type: mongoose.Schema.Types.String })
  username!: string;

  @Prop({ required: true, unique: true, type: mongoose.Schema.Types.String })
  email!: string;

  @Prop({ required: true, type: mongoose.Schema.Types.String })
  password!: string;

  @Prop({ required: true, type: mongoose.Schema.Types.Boolean })
  activated!: boolean;

  // @Prop({ required: true, type: mongoose.Schema.Types.Date })
  // createdAt!: Date;

  // @Prop({ required: true, type: mongoose.Schema.Types.Date })
  // updatedAt!: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
