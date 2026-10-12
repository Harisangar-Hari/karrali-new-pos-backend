import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtUser } from '../../modules/auth/strategies/jwt.strategy';

export const CurrentUser = createParamDecorator(
    (data: keyof JwtUser | undefined, ctx: ExecutionContext) => {
        const req = ctx.switchToHttp().getRequest();
        const user: JwtUser = req.user;
        return data ? user?.[data] : user;
    },
);