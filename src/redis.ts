import Redis from 'ioredis';
import * as Y from 'yjs';
import config from './config.js';
import { WSSharedDoc } from './setupWSConnection.js';

const redis = new Redis(config.redis);

export default redis;

export const getDocUpdatesKey = (doc: WSSharedDoc) => `doc:${doc.id}:recent_updates`;

export const getDocUpdatesFromQueue = async (doc: WSSharedDoc) => {
  return await redis.lrangeBuffer(getDocUpdatesKey(doc), 0, -1);
}

export const pushDocUpdatesToQueue = async (doc: WSSharedDoc, update: Uint8Array) => {
  const len = await redis.llen(getDocUpdatesKey(doc));
  if (len > 100) {
    await redis.pipeline()
      .lpopBuffer(getDocUpdatesKey(doc))
      .rpushBuffer(getDocUpdatesKey(doc), Buffer.from(update))
      .expire(getDocUpdatesKey(doc), 300)
      .exec()
  } else {
    await redis.pipeline()
      .rpushBuffer(getDocUpdatesKey(doc), Buffer.from(update))
      .expire(getDocUpdatesKey(doc), 300)
      .exec();
  }
}

export const getDocRedisKey = (docId: string) => `doc:${docId}:all_updates`

export const docRedisLifetimeInS = 3600;

export const saveDocUpdateInRedis = async (docId: string, update: Uint8Array) => {
  const key = getDocRedisKey(docId);

  const len = await redis.llen(key);
  
  if (len > 100) {
    const res = await redis.pipeline()
      .lrangeBuffer(key, 0, 100)
      .rpushBuffer(key, Buffer.from(update))
      .ltrim(key, 0, 100)
      .exec()
    ;

    const [, leftUpdates]: [Error | null, Buffer[]] = res[0];

    const doc = new Y.Doc();
    for (const u of leftUpdates) {
      Y.applyUpdate(doc, u);
    }

    const combinedUpdate = Y.encodeStateAsUpdate(doc);
    await redis.lpushBuffer(key, Buffer.from(combinedUpdate));
  } else {
    await redis.pipeline()
      .rpushBuffer(key, Buffer.from(update))
      .expire(key, docRedisLifetimeInS)
      .exec()
    ;
  }
}