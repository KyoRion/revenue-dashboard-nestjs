import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { DashboardAdminController } from './dashboard-admin.controller.js';
import { DashboardAdminService } from './dashboard-admin.service.js';

@Module({
  controllers: [DashboardController, DashboardAdminController],
  providers: [DashboardService, DashboardAdminService],
  imports: [AuthModule],
})
export class DashboardModule {}
