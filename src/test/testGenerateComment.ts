import { generateCustomerComment } from '../services/openai.js';
import { extractAllGamesList, extractGamesInLoacation } from '../services/searchEscapeBar.js';

async function main() {
    const title = '偶像出道';
    const location = '台北';

    const games = await extractAllGamesList(title);
    const gamesInLocation = await extractGamesInLoacation(games, location);
    if (!gamesInLocation || gamesInLocation.length === 0) {
        console.log(`找不到密室主題`);
    } else if (gamesInLocation.length > 1) {
        return ` 有多個同名密室在「${location}」`;
    }
    const comment = await generateCustomerComment(gamesInLocation[0].gameId);
    console.log(comment);
}

main();