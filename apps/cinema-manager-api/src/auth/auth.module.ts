import { Module, Global } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { CognitoAuthGuard, AgentOrUserAuthGuard } from './cognito-auth.guard';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, CognitoAuthGuard, AgentOrUserAuthGuard],
  exports: [AuthService, CognitoAuthGuard, AgentOrUserAuthGuard],
})
export class AuthModule {}
