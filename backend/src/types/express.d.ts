declare namespace Express {
  interface Request {
    user?: {
      authId: string;
      userId: string;
      phone: string;
      isVerified: boolean;
    };
    rawBody?: Buffer;
  }
}
