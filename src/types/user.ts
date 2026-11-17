import { OnBoarding, User } from "@schemas/user";
import { Roles, PermissionValue } from "./permissions";
import mongoose from "mongoose";

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

export type UserLean = Omit<User, "password"> & {
  _id: mongoose.Types.ObjectId;
};

export interface IAuthUser {
  id: string;
  username: string;
  role: Roles;
  permissions_overrides?: Record<PermissionValue, boolean>;
}

export type UserWithPassword = UserLean & { password: string | null };
