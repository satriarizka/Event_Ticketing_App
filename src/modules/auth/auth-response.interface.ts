import { Request } from 'express';
import { User } from 'src/entities/user.entity';

export type SanitizedUser = Omit<User, 'passwordHash'>;

export interface JwtPayload {
    sub: string;
    email: string;
    role: string;
}

export interface RegisterResponse {
    message: string;
    user: SanitizedUser;
}

export interface LoginResponse {
    access_token: string;
    user: SanitizedUser;
}

export interface RequestWithUser extends Request {
    user: User;
}
