import { searchEscapeBar } from './searchEscapeBar.js'

async function main() {
const html = await searchEscapeBar('奪命鎖鏈1', '台北');
console.log(html); // /game/xxxxxx
}

main();
