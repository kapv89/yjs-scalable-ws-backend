import * as t from 'lib0/testing.js';
import * as Y from 'yjs';
import faker from 'faker';
import WebSocket from 'ws';
import { WebsocketProvider } from 'y-websocket';
import range from 'lodash/range.js';
import { run } from '../app.js';
import { nockActivate, nockCleanAll, nockGetUpdates, nockPostUpdate, wsUrl } from './index.js';

export const testSingleDoc = async (tc: t.TestCase) => {
  nockActivate();

  const close = await run();

  const id = faker.datatype.uuid();
  const token = faker.lorem.word();
  const doc = new Y.Doc();
  const updates: string[] = []

  nockGetUpdates(id, updates);
  nockPostUpdate(id, updates);

  const wsp = new WebsocketProvider(wsUrl(), id, doc, {WebSocketPolyfill: WebSocket as any})

  const items = doc.getArray('items');
  items.push([faker.random.word()]);

  await new Promise<void>(resolve => setTimeout(resolve, 1000));
  wsp.awareness.destroy();
  wsp.destroy();
  await close();
  nockCleanAll();
}

export const testTwoDocs = async (tc: t.TestCase) => {
  nockActivate();

  const close = await run();

  const id = faker.datatype.uuid();
  const token1 = faker.lorem.word();
  const token2 = faker.lorem.word();
  const doc1 = new Y.Doc();
  const doc2 = new Y.Doc();
  const updates: string[] = [];

  nockGetUpdates(id, updates);
  nockPostUpdate(id, updates);

  const wsp1 = new WebsocketProvider(wsUrl(), id, doc1, {WebSocketPolyfill: WebSocket as any});
  const wsp2 = new WebsocketProvider(wsUrl(), id, doc2, {WebSocketPolyfill: WebSocket as any});

  const words = range(0, 3).map(() => faker.random.word());

  const items1 = doc1.getArray('items');

  for (const w of words) {
    items1.push([w]);
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  const items2 = doc2.getArray('items');

  items1.forEach((w, i) => {
    t.compare(w, items2.get(i));
  });

  await new Promise<void>(resolve => setTimeout(resolve, 1000));
  wsp1.awareness.destroy();
  wsp1.destroy();
  wsp2.awareness.destroy();
  wsp2.destroy();
  await new Promise<void>(resolve => setTimeout(resolve, 1000));
  await close();
  nockCleanAll();
}