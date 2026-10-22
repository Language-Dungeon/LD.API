export interface ITokenRotationCachePayload {
  jti: string;
  revoked: boolean;
}

export interface IUserOTPCachePayload {
  otp: string;
}
