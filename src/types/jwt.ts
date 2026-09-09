import { JwtPayload as BaseJwtPayload } from "jsonwebtoken";
import { IUserAttributes } from "../schemas/user";

type StrictJwtPayload = Omit<BaseJwtPayload, string> & {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  jti?: string;
};

export type JwtPayload = Required<StrictJwtPayload> & Omit<IUserAttributes, "password">;
export type JwtRawPayload = Omit<JwtPayload, "exp" | "iat" | "iss" | "aud" | "jti" | number>;

export type JwtRefreshPayload = Required<StrictJwtPayload> & {
  /** Stable identifier shared by all refresh tokens issued by one login session. */
  familyId: string;
};

export type JwtRefreshRawPayload = Pick<JwtRawPayload, "sub"> & {
  familyId: string;
};

export interface ITokenRotationCachePayload {
  jti: string;
  revoked: boolean;
}
