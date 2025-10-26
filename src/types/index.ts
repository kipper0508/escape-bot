export interface GameInfo {
    title: string;
    cityId: string;
    gameId: string;
}

export interface Event {
    id: number;
    title: string;
    description: string | null;
    location: string;
    eventTime: Date;
    remindBefore: number;
    reminded: boolean;
    createdAt: Date;
    createdById: string;
    createByType: 'user' | 'group';
}

export interface CreateEventData {
    title: string;
    location: string;
    eventTime: Date;
    createdById: string;
    createByType: 'user' | 'group';
    remindBefore?: number;
    description?: string;
}

export type CommandType = 'add' | 'queryUpcomings' | 'query' | 'queryHistory' | 'delete' | 'search' | 'comment' | 'help' | 'none';

export interface ParsedCommand {
    type: CommandType;
    title?: string;
    eventTime?: Date;
    eventTimeHour?: boolean;
    location?: string;
}

export interface Review {
    rating: number;
    comment: string;
    feedbackPoints: number;
    isSpoiler?: boolean;
};

export interface ReviewApiResponse {
    reviewDataList?: Review[];
    lastUserCustomId?: string;
};