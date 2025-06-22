import { searchEscapeBar,generateDescription } from '../services/searchEscapeBar.js'
import { handleGenDescription } from '../webhook/commandHandler.js'

async function main() {
const desc = await handleGenDescription('奪命鎖鏈1', '台北');
console.log(desc);
}

main();
