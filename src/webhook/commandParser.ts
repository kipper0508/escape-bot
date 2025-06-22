export type CommandType = 'add' | 'queryAll' | 'queryOne' | 'deleteOne' | 'search' | 'help' | 'none';

export interface ParsedCommand {
    type: CommandType;
    title?: string;
    time?: Date;
    location?: string;
}

const currentYear = new Date().getFullYear();

// 將 6/20 16:00 轉為 Date（預設今年）
function parseDateTime(raw: string): Date | undefined {
    const match = raw.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
    if (!match) return undefined;

    const [, month, day, hour, minute] = match.map(Number);
    return new Date(currentYear, month - 1, day, hour, minute);
}

export function parseCommand(input: string): ParsedCommand {
    // 將全形括號轉成半形
    const text = input.replace(/（/g, '(').replace(/）/g, ')').trim();

    // === 1. 新增指令 ===
    const addMatch = text.match(/^小精靈\s+新增\s+(\d{1,2}\/\d{1,2})\s+(\d{1,2}:\d{2})\s+(.+?)\s+(.+)$/);
    if (addMatch) {
        const [, date, time, title, location] = addMatch;
        const dateTime = parseDateTime(`${date} ${time}`);
        return {
            type: 'add',
            title,
            time: dateTime,
            location,
        };
    }

    // === 2. 查詢所有 ===
    if (/^小精靈\s+查詢所有$/.test(text)) {
        return { type: 'queryAll' };
    }

    // === 3. 查詢 / 刪除 單一活動 ===
    const queryDelMatch = text.match(/^小精靈\s+(查詢|刪除)\s+([^\(]+?)(?:\s+\((.*?)\))?$/);
    if (queryDelMatch) {
        const [, action, titleRaw, meta] = queryDelMatch;
        const title = titleRaw.trim();
        let time: Date | undefined;
        let location: string | undefined;

        if (meta) {
            const parts = meta.trim().split(/\s+/);
            if (parts.length === 2 && /^\d{1,2}\/\d{1,2}$/.test(parts[0]) && /^\d{1,2}:\d{2}$/.test(parts[1])) {
                time = parseDateTime(`${parts[0]} ${parts[1]}`);
            } else {
                if (parts.length >= 1 && /^\d{1,2}\/\d{1,2}$/.test(parts[0])) {
                    time = parseDateTime(`${parts[0]} 00:00`);
                }
                if (parts.length >= 2) {
                    location = parts.slice(-1).join(' ');
                }
            }
        }

        return {
            type: action === '查詢' ? 'queryOne' : 'deleteOne',
            title,
            time,
            location,
        };
    }

    // === 4. 找主題(不新增) ===
    const searchMatch = text.match(/^小精靈\s+找主題\s+(.+?)\s+(\S+)$/);
    if (searchMatch) {
        const [, title, location] = searchMatch;
        return {
            type: 'search',
            title: title.trim(),
            location: location.trim(),
        };
    }

    // === 5. 幫助 ===
    if (/^小精靈\s+幫助$/.test(text)) {
        return {
            type: 'help',
        };
    }

    // === fallback: 不支援的格式 ===
    return {
        type: 'none',
    };
}
