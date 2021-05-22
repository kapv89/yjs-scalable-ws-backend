import * as t from 'lib0/testing.js';
import * as Y from 'yjs';
import faker from 'faker';
import WS from 'ws';
import { WebsocketProvider } from 'y-websocket';
import { run } from '../app.js';
import config from "../config.js";
import { create, drop } from '../tables.js';

const wsUrl = (): string => `ws://${config.server.host}:${config.server.port}`;

export const testSingleDoc = async (tc: t.TestCase) => {
  await drop();
  await create();

  const close = await run();

  const id = faker.datatype.uuid();
  const doc = new Y.Doc();

  const wsp = new WebsocketProvider(wsUrl(), id, doc, {WebSocketPolyfill: WS as any})

  const items = doc.getArray('items');
  items.push([faker.random.word()]);

  await new Promise<void>(resolve => setTimeout(resolve, 1000));
  wsp.destroy();
  await close();
}