import { PrismaClient } from '@prisma/client';
import { Event, CreateEventData } from '../types/index.js';
import { CONSTANTS } from '../config/constants.js';

export class EventRepository {
    constructor(private prisma: PrismaClient) { }

    async create(data: CreateEventData): Promise<Event> {
        const event = await this.prisma.event.create({
            data: {
                title: data.title,
                description: data.description || null,
                location: data.location,
                eventTime: data.eventTime,
                remindBefore: data.remindBefore || CONSTANTS.DEFAULT_REMINDER_MINUTES,
                createdById: data.createdById,
                createByType: data.createByType as any,
            }
        });

        return event as Event;
    }

    async findByCreator(creatorId: string, creatorType: 'user' | 'group'): Promise<Event[]> {
        const events = await this.prisma.event.findMany({
            where: {
                createdById: creatorId,
                createByType: creatorType as any,
            },
            orderBy: { eventTime: 'asc' }
        });

        return events as Event[];
    }

    async findUpcomings(creatorId: string, creatorType: 'user' | 'group'): Promise<Event[]> {
        const events = await this.prisma.event.findMany({
            where: {
                createdById: creatorId,
                createByType: creatorType as any,
                eventTime: { gt: new Date() }
            },
            orderBy: { eventTime: 'asc' }
        });

        return events as Event[];
    }

    async findMatching(
        creatorId: string,
        creatorType: 'user' | 'group',
        title: string,
        eventTime?: Date,
        enentTimeHour?: boolean,
        location?: string
    ): Promise<Event[]> {
        const where: any = {
            createdById: creatorId,
            createByType: creatorType as any,
            title
        };

        if (eventTime) {
            if (enentTimeHour) {
                where.eventTime = eventTime;
            }
            else {
                const day = new Date(eventTime);
                const hourBegin = new Date(day.setHours(0, 0, 0, 0));
                const hourEnd = new Date(day.setHours(23, 59, 59, 999));
                where.eventTime = { gte: hourBegin, lte: hourEnd };
            }
        }

        if (location) {
            where.location = location;
        }

        const events = await this.prisma.event.findMany({ where });
        return events as Event[];
    }

    async findHistory(creatorId: string, creatorType: 'user' | 'group'): Promise<Event[]> {
        const now = new Date();
        const events = await this.prisma.event.findMany({
            where: {
                eventTime: { lt: now },
                createdById: creatorId,
                createByType: creatorType as any,
            },
            orderBy: { eventTime: 'asc' },
        });

        return events as Event[];
    }

    async findNeedingReminder(): Promise<Event[]> {
        const nowTimeZone = new Date(new Date().getTime() + CONSTANTS.TIME_ZONE * 60 * 60 * 1000);

        const events = await this.prisma.event.findMany({
            where: {
                reminded: false,
                createByType: 'group' as any,
                eventTime: { gt: nowTimeZone }
            }
        });

        return events as Event[];
    }

    async markAsReminded(eventId: number): Promise<void> {
        await this.prisma.event.update({
            where: { id: eventId },
            data: { reminded: true }
        });
    }

    async delete(eventId: number): Promise<void> {
        await this.prisma.userOnEvent.deleteMany({
            where: { eventId: eventId },
        });
        await this.prisma.event.delete({
            where: { id: eventId }
        });
    }
}
