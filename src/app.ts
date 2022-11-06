import express from 'express'
import WebSocket, { WebSocketServer } from 'ws';
import http from 'http';

import config from './config.js';
import { serverLogger } from './logger/index.js';
import setupWSConnection, { cleanup, ConnAccess, getDocIdFromReq, getTokenFromReq } from './setupWSConnection.js';
import { DocAccessRes, getDocAccess } from './apiClient.js';

export const run = async (): Promise<() => Promise<void>> => {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({noServer: true});

  wss.on('connection', async (ws: WebSocket, req: http.IncomingMessage, docAccess: DocAccessRes['access']) => {
    await setupWSConnection(ws, req, new ConnAccess(getTokenFromReq(req), docAccess));
  });

  server.on('upgrade', async (req, socket, head) => {
    const token = getTokenFromReq(req);
    const docId = getDocIdFromReq(req);

    const docAccess = await getDocAccess(docId, token)

    if (docAccess === null) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // check auth
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, docAccess);
    })
  });

  await new Promise<void>(resolve => {
    server.listen(config.server.port, config.server.host, () => {
      resolve();
    })
  });

  const close = async () => {
    cleanup();

    await new Promise<void>(resolve => {
      wss.close(() => {
        resolve()
      })
    });

    await new Promise<void>(resolve => {
      server.close(() => {
        resolve()
      })
    })
  };

  return close;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.on('unhandledRejection', (err) => {
    serverLogger.error(err);
    throw err;
  });

  run().then(() => serverLogger.info(`listening on ${config.server.host}:${config.server.port}`))
}