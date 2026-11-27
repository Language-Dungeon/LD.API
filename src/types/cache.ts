export interface ITokenRotationCachePayload {
  jti: string;
  revoked: boolean;
}

export interface IUserOTPCachePayload {
  otp: string;
}

export interface IAiEmbedCachePayload {
  provider: string;
  model: string;
  vectors: number[][];
}

export interface IAiHealthCachePayload {
  ok: boolean;
  provider: string;
  checkedAt: number;
}
