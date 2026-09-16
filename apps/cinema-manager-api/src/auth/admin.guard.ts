import {
  Injectable,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { CognitoAuthGuard } from './cognito-auth.guard';

@Injectable()
export class AdminGuard extends CognitoAuthGuard {
  private readonly adminLogger = new Logger(AdminGuard.name);
  private readonly adminEmail = process.env.ADMIN_EMAIL || 'abhijeetkharkar@gmail.com';

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isAuthenticated = await super.canActivate(context);
    if (!isAuthenticated) {
      return false;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const userEmail = (user?.email || '').toLowerCase().trim();
    const authorizedEmail = this.adminEmail.toLowerCase().trim();

    if (userEmail !== authorizedEmail) {
      this.adminLogger.warn(`Unauthorized admin access attempt by: ${userEmail || 'unknown'}`);
      throw new ForbiddenException('Admin access restricted to authorized administrator.');
    }

    return true;
  }
}
