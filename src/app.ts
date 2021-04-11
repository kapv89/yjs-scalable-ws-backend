import express from 'express'
import WS from 'ws';
import http from 'http';

import config from './config.js';
import { serverLogger } from './logger/index.js';
import setupWSConnection from './setupWSConnection.js';

export const app = express();
export const server = http.createServer(app);
export const wss = new WS.Server({noServer: true});

wss.on('connection', async (ws, req) => {
  await setupWSConnection(ws, req);
});

server.on('upgrade', (req, socket, head) => {
  // check auth
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  })
});

export const run = async (): Promise<() => Promise<void>> => {
  await new Promise<void>(resolve => {
    server.listen(config.server.port, config.server.host, () => {
      resolve();
    })
  });

  return async () => {
    return new Promise<void>(resolve => {
      server.close(() => {
        resolve()
      })
    })
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.on('unhandledRejection', (err) => {
    serverLogger.error(err);
    throw err;
  });

  run().then(() => serverLogger.info(`listening on ${config.server.host}:${config.server.port}`))
}