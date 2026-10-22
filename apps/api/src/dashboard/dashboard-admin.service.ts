import { 
    Injectable,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDashboardDto } from './dto/create-dashboard.dto.js';

@Injectable()
export class DashboardAdminService {

    constructor(private readonly prisma: PrismaService) {}

    findAll() {
    return this.prisma.weeklyDashboard.findMany({
        orderBy: { weekStart: 'desc' },
        include: {
        metrics: true,
        events: true,
        },
    });
    }

    create(dto: CreateDashboardDto) {
        return this.prisma.weeklyDashboard.create({
            data: {
            weekStart: new Date(dto.weekStart),
            previousWeekStart: new Date(dto.previousWeekStart),
            metrics: {
                create: dto.metrics.map((metric) => ({
                    period: metric.period,
                    businessDate: new Date(metric.businessDate),
                    posRevenue: metric.posRevenue ?? 0,
                    eatclubRevenue: metric.eatclubRevenue ?? 0,
                    directRevenue: metric.directRevenue ?? 0,
                    totalRevenue: metric.totalRevenue ?? 0,
                    labourCosts: metric.labourCosts ?? 0,
                    covers: metric.covers ?? 0,
                })),
            },
            events: {
                create: (dto.events ?? []).map((event) => ({
                    eventDate: new Date(event.eventDate),
                    label: event.label,
                    direction: event.direction,
                })),
            },
            },
            include: {
                metrics: true,
                events: true,
            },
        });
    }

    private parseWeekStart(value: string): Date {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            throw new BadRequestException('weekStart must be in YYYY-MM-DD format');
        }

        const date = new Date(`${value}T00:00:00.000Z`);

        if (Number.isNaN(date.getTime())) {
            throw new BadRequestException('weekStart invalid');
        }

        return date;
    }

    async update(weekStart: string, dto: CreateDashboardDto) {
        const weekStartDate = this.parseWeekStart(weekStart);

        if (dto.weekStart !== weekStart) {
            throw new BadRequestException(
                'The `weekStart` value in the URL and the body must match.',
            );
        }

        return this.prisma.$transaction(async (tx) => {
            const dashboard = await tx.weeklyDashboard.findUnique({
                where: { weekStart: weekStartDate },
            });

            if (!dashboard) {
                throw new NotFoundException('Not found dashboard for this week');
            }

            await tx.weeklyDashboard.update({
                where: { id: dashboard.id },
                data: {
                    previousWeekStart: new Date(dto.previousWeekStart),
                },
            });

            await tx.dailyMetric.deleteMany({
                where: { dashboardId: dashboard.id },
            });

            await tx.dashboardEvent.deleteMany({
                where: { dashboardId: dashboard.id },
            });

            await tx.dailyMetric.createMany({
                data: dto.metrics.map((metric) => ({
                    dashboardId: dashboard.id,
                    period: metric.period,
                    businessDate: new Date(metric.businessDate),
                    posRevenue: metric.posRevenue ?? 0,
                    eatclubRevenue: metric.eatclubRevenue ?? 0,
                    directRevenue: metric.directRevenue ?? 0,
                    totalRevenue: metric.totalRevenue ?? 0,
                    labourCosts: metric.labourCosts ?? 0,
                    covers: metric.covers ?? 0,
                })),
            });

            if (dto.events?.length) {
                await tx.dashboardEvent.createMany({
                    data: dto.events.map((event) => ({
                        dashboardId: dashboard.id,
                        eventDate: new Date(event.eventDate),
                        label: event.label,
                        direction: event.direction,
                    })),
                });
            }

            return tx.weeklyDashboard.findUnique({
                where: { id: dashboard.id },
                include: {
                metrics: true,
                events: true,
                },
            });
        });
    }

    async remove(weekStart: string) {
        const weekStartDate = this.parseWeekStart(weekStart);

        const dashboard = await this.prisma.weeklyDashboard.findUnique({
        where: { weekStart: weekStartDate },
        });

        if (!dashboard) {
        throw new NotFoundException('Not found dashboard for this week');
        }

        await this.prisma.weeklyDashboard.delete({
        where: { id: dashboard.id },
        });

        return {
            message: 'Dashboard deleted',
            weekStart,
        };
    }
}