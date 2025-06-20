import { fetch } from 'undici';
import { load } from 'cheerio';
import dotenv from 'dotenv';

dotenv.config();

const cityNameToId: Record<string, string> = {
  '台北': '101',
  '新北': '102',
  '基隆': '103',
  '桃園': '104',
  '新竹': '105',
  '苗栗': '201',
  '台中': '202',
  '彰化': '203',
  '南投': '204',
  '雲林': '205',
  '嘉義': '301',
  '台南': '303',
  '高雄': '304',
  '屏東': '305',
  '宜蘭': '107',
  '花蓮': '401',
  '台東': '402',
  '澎湖': '500',
  '金門': '500',
  '馬祖': '500',
};

type SimpleGameInfo = {
  title: string;
  cityId: string;
  gameId: string;
};

export async function extractAllGamesListData(title: string) {
  const url = `https://escape.bar/games?outdoor=true&over=true&q=${encodeURIComponent(title)}`;
  const res = await fetch(url);
  const html = await res.text();
  const $ = load(html);

  const scripts = $('script');
  const allGames: any[] = [];

  scripts.each((_, script) => {
    const scriptContent = $(script).html();
    if (!scriptContent || !scriptContent.includes('self.__next_f.push')) return;

    const match = scriptContent.match(/self\.__next_f\.push\(\[\d+,"(b:.*?)"\]\)/s);
    if (!match) return;


    try {
      const encodedStr = match[1]; // b:["$","$L18",null,{...}]
      const colonIndex = encodedStr.indexOf(':');
      
      if (colonIndex === -1) return;

      const jsonLike = encodedStr.slice(colonIndex + 1); // remove `b:`
      const level1JsonStr = JSON.parse(`"${jsonLike}"`); // 👈 第一次 parse：變成正常 JSON 格式
      const level1 = JSON.parse(level1JsonStr);             // 👈 第二次 parse：變成 JS 物件

      const gamesList = level1?.[3]?.gamesListData;

      if (Array.isArray(gamesList)) {
            const basicGames = gamesList.map((g: any): SimpleGameInfo => ({
                title: g.title,
                cityId: g.cityId,
                gameId: g.gameId,
            }));
            allGames.push(...basicGames);
      }
    } catch (err) {
      console.error('解析失敗，略過一筆 script：', err);
    }
  });

  return allGames;
}

export async function searchEscapeBar(title: string, location: string): Promise<string | null> {
  const allGames = await extractAllGamesListData(title);

  const cityId = cityNameToId[location];
  if (!cityId) {
    return null;
  }

  // 篩選符合 title + cityId
  const matchedGames = allGames.filter(g =>
    g.title.includes(title) && g.cityId === cityId
  );

  if (matchedGames.length === 0) {
    return null; // 找不到
  }

  const gameId = matchedGames[0].gameId;

  const url = `https://escape.bar/game/${gameId}`;
  return url;
}

export async function generateDescription(url: string) {
  const res = await fetch(url);
  if (!res.ok) return null;

  const html = await res.text();
  const $ = load(html);

  const spans = $("span.text-sm.lg\\:text-base.font-medium").toArray();
  const people = spans[0] ? $(spans[0]).text().trim() : "未知";
  const duration = spans[1] ? $(spans[1]).text().trim() : "未知";

  const addrEl = $("a.text-sm.lg\\:text-base.hover\\:text-secondary").first();
  const address = addrEl.text().trim() || "未知";
  const googleMapLink = addrEl.attr("href") || "";

  const price = $("p.mb-2.pl-4.leading-normal.text-sm.lg\\:text-base.whitespace-pre-wrap")
    .first()
    .text()
    .replace(/\n/g, " ") 
    .trim() || "未知";


  return `人數：${people}\n遊戲時長：${duration}\n價格: ${price}\n主題介紹: ${url}\n地址：${address}\n${googleMapLink}`;
}
