import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { HydratedDocument } from "mongoose";
import { PermissionValue, ROLES, type Roles } from "@types";

export interface IUserAttributes {
  // id: string;
  username: string;
  email: string;
  email_hmac: string;
  password: string | null;
  activated: boolean;
  role: Roles;
  permissions_overrides?: Record<PermissionValue, boolean>;
  onboarding?: OnBoarding[];
}

export interface IAnswer {
  questionId: string;
  answerId: string;
}

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

  //TODO: rozwazyc dodanie select: false, dzieki temu nie pobiera hasla z bazy
  @Prop({ required: false, allowNull: true, type: mongoose.Schema.Types.String })
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
