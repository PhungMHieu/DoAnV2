export interface JwtPayload {
  sub: string;      // userId
  username: string;
  email: string;
  roles?: string[];
  iat?: number;
  exp?: number;
}
