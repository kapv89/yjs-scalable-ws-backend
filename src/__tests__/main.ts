import wtf from 'wtfnode';
import {runTests} from 'lib0/testing.js';
import { pub, sub } from '../pubsub.js';
import redis from '../redis.js';
import * as app from './app.test.js';
import knex from '../knex.js';

if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const res = await runTests({app});
    await Promise.all([
      pub.quit(),
      sub.quit(),
      knex.destroy(),
      redis.quit()
    ]);

    return res;
  })().then((res) => {
    wtf.dump();
    if (res) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  });
}