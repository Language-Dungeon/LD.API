import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { HydratedDocument } from "mongoose";
import { type IAnswer, IUserAttributes, type PermissionValue, ROLES, type Roles } from "@types";

@Schema({ _id: false })
export class OnBoarding implements IAnswer {
  @Prop({ required: true, type: mongoose.Schema.Types.String, unique: true })
  questionId!: string;

  @Prop({ required: true, type: mongoose.Schema.Types.String })
  answerId!: string;
}

export type OnBoardingDocument = HydratedDocument<OnBoarding>;
export const OnBoardingSchema = SchemaFactory.createForClass(OnBoarding);

@Schema({ timestamps: true })
export class User implements IUserAttributes {
  @Prop({ required: true, type: mongoose.Schema.Types.String })
  username!: string;

  @Prop({ required: true, unique: true, type: mongoose.Schema.Types.String })
  email!: string;

  @Prop({ required: true, unique: true, type: mongoose.Schema.Types.String })
  email_hmac!: string;

  @Prop({ required: false, allowNull: true, type: mongoose.Schema.Types.String, select: false })
  password!: string | null;

  @Prop({ required: true, type: mongoose.Schema.Types.Boolean, default: false })
  activated!: boolean;

  @Prop({ required: false, type: mongoose.Schema.Types.String, enum: ROLES, default: ROLES[0] }) // ROLES[0] == "user"
  role!: Roles;

  @Prop({ required: false, type: Map, of: Boolean, default: {} })
  permissions_overrides?: Record<PermissionValue, boolean>;

  @Prop({ required: false, schema: OnBoardingSchema, default: [] })
  onboarding!: OnBoarding[];
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
