import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { HydratedDocument } from "mongoose";

const AUTH_PROVIDERS = ["local", "google"] as const;
type AuthProviders = (typeof AUTH_PROVIDERS)[number];

export interface IAuthTypeAttributes {
  email_hmac: string;
  auth_provider: string;
}

@Schema()
export class AuthType implements IAuthTypeAttributes {
  @Prop({ required: true, unique: true, type: mongoose.Schema.Types.String })
  user_id!: string;

  @Prop({ required: true, unique: true, type: mongoose.Schema.Types.String })
  email_hmac!: string;

  @Prop({ enum: AUTH_PROVIDERS })
  auth_provider!: AuthProviders;
}

export type AuthTypeDocument = HydratedDocument<AuthType>;
export const AuthTypeSchema = SchemaFactory.createForClass(AuthType);
