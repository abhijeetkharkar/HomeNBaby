import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthService } from './auth.service';

export interface AuthenticatedUser {
  userId: string;
  email?: string;
  isAgent?: boolean;
  agentId?: string;
}

@Injectable()
export class CognitoAuthGuard implements CanActivate {
  private readonly logger = new Logger(CognitoAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] || '';

    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7).trim();
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new UnauthorizedException('Invalid JWT structure');
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        throw new UnauthorizedException('Token has expired');
      }

      const userId = payload.sub || payload['cognito:username'] || payload.username;
      if (!userId) {
        throw new UnauthorizedException('Token payload does not contain user ID');
      }

      request.user = {
        userId,
        email: payload.email || '',
        isAgent: false,
      } as AuthenticatedUser;

      return true;
    } catch (err) {
      this.logger.warn('Cognito JWT validation failed:', err);
      throw new UnauthorizedException('Authentication failed');
    }
  }
}

@Injectable()
export class AgentOrUserAuthGuard implements CanActivate {
  private readonly logger = new Logger(AgentOrUserAuthGuard.name);

  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const agentToken = request.headers['x-agent-token'] as string;
    const authHeader = request.headers['authorization'] || '';

    // 1. Check if valid Agent Token
    if (agentToken) {
      const agent = await this.authService.validateAgentToken(agentToken);
      if (agent) {
        request.user = {
          userId: agent.userId,
          agentId: agent.agentId,
          isAgent: true,
        } as AuthenticatedUser;
        return true;
      }
    }

    // 2. Fall back to Bearer token
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
          const now = Math.floor(Date.now() / 1000);
          if (payload.exp && payload.exp >= now) {
            request.user = {
              userId: payload.sub || payload['cognito:username'],
              email: payload.email || '',
              isAgent: false,
            } as AuthenticatedUser;
            return true;
          }
        }
      } catch (err) {
        this.logger.warn('Token validation failed in AgentOrUserAuthGuard:', err);
      }
    }

    throw new UnauthorizedException('Unauthorized: Valid user token or agent token required');
  }
}
