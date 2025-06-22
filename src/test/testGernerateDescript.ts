import { searchEscapeBar,generateDescription } from '../services/searchEscapeBar.js'

async function handleGenDscription(
  title: string,
  time: Date,
  location: string,
): Promise<string> {
  const gameUrl = await searchEscapeBar(title,location);
  if (!gameUrl) return '❌ 找不到密室主題';

  const desc = await generateDescription(gameUrl);
  if (!gameUrl) return '⚠️  系統無法辨識的頁面: gameUrl';

  return desc;
}

async function main() {
const desc = await handleGenDscription('奪命鎖鏈1', new Date(), '台北');
console.log(desc);
}

main();
