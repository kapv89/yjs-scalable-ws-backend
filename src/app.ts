import express from 'express'
import WS from 'ws';
import http from 'http';

import config from './config';
import { serverLogger } from './logger';
import { setupWSConnection } from './service';

export const app = express();
export const server = http.createServer(app);
export const wss = new WS.Server({noServer: true, path: '/connect'});

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

if (require.main === module) {
  process.on('unhandledRejection', (err) => {
    serverLogger.error(err);
    throw err;
  });

  run().then(() => serverLogger.info(`listening on ${config.server.host}:${config.server.port}`))
}