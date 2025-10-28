import { User } from 'src/entities/user.entity';

export interface RegisterResponse {
    message: string;
    user: User;
}

export interface LoginResponse {
    access_token: string;
    user: User;
}

export interface JwtPayload {
    sub: string;
    role: string;
    email: string;
}

export interface RequestWithUser extends Request {
    user: User;
}
