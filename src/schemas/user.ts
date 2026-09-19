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
}

@Schema({ timestamps: true })
export class User implements IUserAttributes {
  @Prop({ required: true, type: mongoose.Schema.Types.String })
  username!: string;

  @Prop({ required: true, unique: true, type: mongoose.Schema.Types.String })
  email!: string;

  @Prop({ required: true, unique: true, type: mongoose.Schema.Types.String })
  email_hmac!: string;

  @Prop({ required: false, allowNull: true, type: mongoose.Schema.Types.String })
  password!: string | null;

  @Prop({ required: true, type: mongoose.Schema.Types.Boolean })
  activated!: boolean;

  @Prop({ required: false, enum: ROLES, default: ROLES[0] }) // ROLES[0] == "user"
  role!: Roles;

  @Prop({ required: false, type: Object, default: {} })
  permissions_overrides?: Record<PermissionValue, boolean>;

  // @Prop({ required: true, type: mongoose.Schema.Types.String })
  // auth_provider!: AuthProviderType;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
