import Redis from 'ioredis';
import config from './config.js';

export const pub = new Redis(config.redis.port, config.redis.host);
export const sub = new Redis(config.redis.port, config.redis.host);