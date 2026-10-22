import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(weekStart?: string) {
    let dashboard;

    if (weekStart) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
        throw new BadRequestException('weekStart phải có định dạng YYYY-MM-DD');
      }

      const date = new Date(`${weekStart}T00:00:00.000Z`);

      if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== weekStart
      ) {
        throw new BadRequestException('weekStart không hợp lệ');
      }

      dashboard = await this.prisma.weeklyDashboard.findUnique({
        where: { weekStart: date },
        include: {
          metrics: { orderBy: { businessDate: 'asc' } },
          events: { orderBy: { eventDate: 'asc' } },
        },
      });
    } else {
      dashboard = await this.prisma.weeklyDashboard.findFirst({
        orderBy: { weekStart: 'desc' },
        include: {
          metrics: { orderBy: { businessDate: 'asc' } },
          events: { orderBy: { eventDate: 'asc' } },
        },
      });
    }

    if (!dashboard) {
      throw new NotFoundException('Không tìm thấy dashboard');
    }

    return {
      weekStart: dashboard.weekStart.toISOString().slice(0, 10),
      previousWeekStart: dashboard.previousWeekStart.toISOString().slice(0, 10),
      metrics: dashboard.metrics.map((metric) => ({
        period: metric.period,
        businessDate: metric.businessDate.toISOString().slice(0, 10),
        posRevenue: Number(metric.posRevenue),
        eatclubRevenue: Number(metric.eatclubRevenue),
        directRevenue: Number(metric.directRevenue),
        totalRevenue: Number(metric.totalRevenue),
        labourCosts: Number(metric.labourCosts),
        covers: metric.covers,
      })),
      events: dashboard.events.map((event) => ({
        eventDate: event.eventDate.toISOString().slice(0, 10),
        label: event.label,
        direction: event.direction,
      })),
    };
  }
}