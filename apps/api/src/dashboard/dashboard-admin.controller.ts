import { 
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateDashboardDto } from './dto/create-dashboard.dto.js';
import { DashboardAdminService } from './dashboard-admin.service.js';

@Controller('admin/dashboards')
@UseGuards(JwtAuthGuard)
export class DashboardAdminController {
  constructor(private readonly dashboardAdminService: DashboardAdminService) {}

  @Get()
  findAll() {
    return this.dashboardAdminService.findAll();
  }

  @Post()
  create(@Body() dto: CreateDashboardDto) {
    return this.dashboardAdminService.create(dto);
  }

  @Put(':weekStart')
  update(
    @Param('weekStart') weekStart: string,
    @Body() dto: CreateDashboardDto,
  ) {
    return this.dashboardAdminService.update(weekStart, dto);
  }

  @Delete(':weekStart')
  remove(@Param('weekStart') weekStart: string) {
    return this.dashboardAdminService.remove(weekStart);
  }
}