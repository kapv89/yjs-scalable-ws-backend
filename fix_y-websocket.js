import * as fs from 'fs';
import {EOL} from 'os';

const path = 'node_modules/y-websocket/package.json';

const json = fs.readFileSync(path, 'utf-8');
const lines = json.split(EOL);

let pivot = -1;
let fix = true;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(`"name": "y-websocket"`)) {
    pivot = i;
  }

  if (lines[i].includes(`"type": "module"`)) {
    fix = false;
  }
}

if (fix) {
  const updatedJson = [...lines.slice(0, pivot+1), `  "type": "module",`, ...lines.slice(pivot+1)].join(EOL);
  fs.writeFileSync(path, updatedJson, 'utf-8');
}