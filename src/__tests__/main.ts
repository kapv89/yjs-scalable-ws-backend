import wtf from 'wtfnode';
import {runTests} from 'lib0/testing.js';
import { pub, sub } from '../pubsub.js';
import * as app from './app.test.js';
import knex from '../knex.js';

if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    await runTests({app});
    await Promise.all([
      pub.quit(),
      sub.quit(),
      knex.destroy()
    ]);
  })().then(() => {
    wtf.dump();
  });
}