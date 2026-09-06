declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- merges Passport Express.User with JwtPayload
    interface Request {
      id: string;
      // user: User;
      // session: JwtRefreshPayload;
    }
  }
}

export {};
