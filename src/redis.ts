import Redis from 'ioredis';
import config from './config.js';
import { WSSharedDoc } from './setupWSConnection.js';

const redis = new Redis(config.redis);

export default redis;

export const getDocUpdatesKey = (doc: WSSharedDoc) => `doc:${doc.name}:updates`;

export const getDocUpdatesFromQueue = async (doc: WSSharedDoc) => {
  return await redis.lrangeBuffer(getDocUpdatesKey(doc), 0, -1);
}

export const pushDocUpdatesToQueue = async (doc: WSSharedDoc, update: Uint8Array) => {
  const len = await redis.llen(getDocUpdatesKey(doc));
  if (len > 100) {
    redis.pipeline()
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