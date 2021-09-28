import * as t from 'lib0/testing.js';
import * as Y from 'yjs';
import faker from 'faker';
import { WebSocket } from 'ws';
import yWebSocket from 'y-websocket';
import range from 'lodash/range.js';
import { run } from '../app.js';
import config from "../config.js";
import { create, drop } from '../tables.js';

const { WebsocketProvider } = yWebSocket;

const wsUrl = (): string => `ws://${config.server.host}:${config.server.port}`;

export const testSingleDoc = async (tc: t.TestCase) => {
  await drop();
  await create();
  const close = await run();

  const id = faker.datatype.uuid();
  const doc = new Y.Doc();

  const wsp = new WebsocketProvider(wsUrl(), id, doc, {WebSocketPolyfill: WebSocket as any})

  const items = doc.getArray('items');
  items.push([faker.random.word()]);

  await new Promise<void>(resolve => setTimeout(resolve, 1000));
  wsp.awareness.destroy();
  wsp.destroy();
  await close();
}

export const testTwoDocs = async (tc: t.TestCase) => {
  await drop();
  await create();
  const close = await run();

  const id = faker.datatype.uuid();
  const doc1 = new Y.Doc();
  const doc2 = new Y.Doc();
  const updates: string[] = [];


  const wsp1 = new WebsocketProvider(wsUrl(), id, doc1, {WebSocketPolyfill: WebSocket as any});
  const wsp2 = new WebsocketProvider(wsUrl(), id, doc2, {WebSocketPolyfill: WebSocket as any});

  const words = range(0, 3).map(() => faker.random.word());

  const items1 = doc1.getArray('items');

  for (const w of words) {
    items1.push([w]);
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  const items2 = doc2.getArray('items');

  items2.forEach((w, i) => {
    t.compare(w, words[i], 'docs not in sync');
  });

  await new Promise<void>(resolve => setTimeout(resolve, 1000));
  wsp1.awareness.destroy();
  wsp1.destroy();
  wsp2.awareness.destroy();
  wsp2.destroy();
  await new Promise<void>(resolve => setTimeout(resolve, 1000));
  await close();
}