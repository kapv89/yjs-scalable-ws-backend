import Redis from 'ioredis';
import * as Y from 'yjs';
import config from './config.js';

const redis = new Redis(config.redis);

export default redis;
