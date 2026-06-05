import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const files = ['stats.json', 'contest-ratings.json'];
const conflictMarkerPattern = /<<<<<<<|=======|>>>>>>>/;

for (const file of files) {
  const path = join(process.cwd(), 'public', file);
  const contents = readFileSync(path, 'utf8');

  if (conflictMarkerPattern.test(contents)) {
    throw new Error(`${file} contains merge conflict markers`);
  }

  JSON.parse(contents);
}

console.log('Validated public JSON data');
