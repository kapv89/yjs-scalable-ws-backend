import * as t from 'lib0/testing.js';
import * as Y from 'yjs';
import faker from 'faker';
import { v4 as uuid } from 'uuid';
import WebSocket from 'ws';
import { WebsocketProvider } from 'y-websocket';
import range from 'lodash/range.js';
import { run } from '../app.js';
import config from "../config.js";
import { create, drop } from '../tables.js';


const wsUrl = (): string => `ws://${config.server.host}:${config.server.port}`;
const wait = async (ms: number) => await new Promise((resolve) => setTimeout(resolve, ms));

export const testSingleDoc = async (tc: t.TestCase) => {
  await wait(1000);
  await drop();
  await create();
  const close = await run();

  const id = uuid();
  const doc = new Y.Doc();

  const wsp = new WebsocketProvider(wsUrl(), id, doc, {WebSocketPolyfill: WebSocket as any})

  const items = doc.getArray('items');
  items.push([faker.random.word()]);

  await wait(1000);
  wsp.awareness.destroy();
  wsp.destroy();
  await wait(1000);
  await close();
  await wait(1000);
}

export const testTwoDocs = async (tc: t.TestCase) => {
  await wait(1000);
  await drop();
  await create();
  const close = await run();
  await wait(1000);


  const id = uuid();
  const doc1 = new Y.Doc();
  const doc2 = new Y.Doc();

  const wsp1 = new WebsocketProvider(wsUrl(), id, doc1, {WebSocketPolyfill: WebSocket as any});
  await wait(1000);
  const wsp2 = new WebsocketProvider(wsUrl(), id, doc2, {WebSocketPolyfill: WebSocket as any});
  await wait(1000);

  const words = range(0, 3).map(() => faker.random.word());
  const items1 = doc1.getArray('items');

  for (const w of words) {
    items1.push([w]);
    await wait(100);
  }

  await wait(100);

  const items2 = doc2.getArray('items');
  items2.forEach((w, i) => {
    t.compare(w, words[i], 'docs not in sync');
  });

  await wait(1000);
  wsp1.awareness.destroy();
  wsp1.destroy();
  wsp2.awareness.destroy();
  wsp2.destroy();
  await wait(1000);
  await close();
  await wait(1000);
}