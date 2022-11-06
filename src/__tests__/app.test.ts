import * as t from 'lib0/testing.js';
import * as Y from 'yjs';
import faker from 'faker';
import WebSocket from 'ws';
import { WebsocketProvider } from 'y-websocket';
import range from 'lodash/range.js';
import { run } from '../app.js';
import { nockActivate, nockSetRWAccess, nockCleanAll, nockGetUpdates, nockPostUpdate, wsUrl } from './index.js';

export const testSingleDoc = async (tc: t.TestCase) => {
  nockActivate();

  const close = await run();

  const id = faker.datatype.uuid();
  const token = faker.internet.password(42);
  const doc = new Y.Doc();
  const updates: string[] = []

  nockSetRWAccess([token], id);
  nockGetUpdates([token], id, updates);
  nockPostUpdate([token], id, updates);

  const wsp = new WebsocketProvider(wsUrl(), id, doc, {params: {token}, WebSocketPolyfill: WebSocket as any})

  const items = doc.getArray('items');
  items.push([faker.random.word()]);

  await new Promise<void>(resolve => setTimeout(resolve, 1000));
  wsp.awareness.destroy();
  wsp.destroy();
  await close();
  nockCleanAll();

  await new Promise<void>(resolve => setTimeout(resolve, 1000));
}

export const testMultipleDocs = async (tc: t.TestCase) => {
  await new Promise<void>(resolve => setTimeout(resolve, 1000));

  nockActivate();

  const close = await run();

  const id = faker.datatype.uuid();
  const token1 = faker.internet.password(42);
  const token2 = faker.internet.password(42);
  const token3 = faker.internet.password(42);
  const doc1 = new Y.Doc();
  const doc2 = new Y.Doc();
  const doc3 = new Y.Doc();
  const updates: string[] = [];

  nockSetRWAccess([token1, token2, token3], id);
  nockGetUpdates([token1, token2, token3], id, updates);
  nockPostUpdate([token1, token2, token3], id, updates);

  const wsp1 = new WebsocketProvider(wsUrl(), id, doc1, {params: {token: token1}, WebSocketPolyfill: WebSocket as any});
  const wsp2 = new WebsocketProvider(wsUrl(), id, doc2, {params: {token: token2}, WebSocketPolyfill: WebSocket as any});

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

  await new Promise<void>(resolve => setTimeout(resolve, 100));
  wsp1.awareness.destroy();
  wsp1.destroy();
  wsp2.awareness.destroy();
  wsp2.destroy();

  const wsp3 = new WebsocketProvider(wsUrl(), id, doc3, {params: {token: token3}, WebSocketPolyfill: WebSocket as any});
  await new Promise<void>(resolve => setTimeout(resolve, 100));

  const items3 = doc3.getArray('items');

  items1.forEach((w, i) => {
    t.compare(w, items3.get(i));
  });

  await new Promise<void>(resolve => setTimeout(resolve, 100));
  wsp3.awareness.destroy();
  wsp3.destroy();
  
  await close();
  nockCleanAll();

  await new Promise<void>(resolve => setTimeout(resolve, 1000));
}