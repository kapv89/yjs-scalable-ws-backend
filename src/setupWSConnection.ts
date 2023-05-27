import { WebSocket, Data as WSData } from 'ws';
import http from 'http';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness.js'
import * as syncProtocol from 'y-protocols/sync.js';
import * as mutex from 'lib0/mutex';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import Redis from 'ioredis';
import knex from './knex.js'
import {pub, sub} from './pubsub.js';
import { getDocUpdatesFromQueue, pushDocUpdatesToQueue } from './redis.js';
import { serverLogger } from './logger/index.js';

const wsReadyStateConnecting = 0
const wsReadyStateOpen = 1
const wsReadyStateClosing = 2 // eslint-disable-line
const wsReadyStateClosed = 3 // eslint-disable-line

const updatesLimit = 50;

export interface DBUpdate {
  id: string;
  docname: string;
  update: Uint8Array;
}

export const messageSync = 0;
export const messageAwareness = 1;

export const pingTimeout = 30000;

export const docs = new Map<string, WSSharedDoc>();

export function cleanup() {
  docs.forEach((doc) => {
    doc.conns.forEach((_, conn) => {
      closeConn(doc, conn);
    })
  })
}

export default async function setupWSConnection(conn: WebSocket, req: http.IncomingMessage): Promise<void> {
  conn.binaryType = 'arraybuffer';
  const docname: string = req.url?.slice(1).split('?')[0] as string;
  const [doc, isNew] = getYDoc(docname);
  doc.conns.set(conn, new Set());
  
  conn.on('message', (message: WSData) => {
    messageListener(conn, req, doc, new Uint8Array(message as ArrayBuffer));
  });

  if (isNew) {
    const persistedUpdates = await getUpdates(doc);
    const dbYDoc = new Y.Doc()

    dbYDoc.transact(() => {
      for (const u of persistedUpdates) {
        Y.applyUpdate(dbYDoc, u.update);
      }
    });

    Y.applyUpdate(doc, Y.encodeStateAsUpdate(dbYDoc));

    const redisUpdates = await getDocUpdatesFromQueue(doc);
    const redisYDoc = new Y.Doc();
    redisYDoc.transact(() => {
      for (const u of redisUpdates) {
        Y.applyUpdate(redisYDoc, u);
      }
    });

    Y.applyUpdate(doc, Y.encodeStateAsUpdate(redisYDoc));
  }

  let pongReceived = true;
  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      if (doc.conns.has(conn)) {
        closeConn(doc, conn);
      }
      clearInterval(pingInterval);
    } else if (doc.conns.has(conn)) {
      pongReceived = false;
      try {
        conn.ping();
      } catch (e) {
        closeConn(doc, conn);
        clearInterval(pingInterval);
      }
    }
  }, pingTimeout);

  conn.on('close', () => {
    closeConn(doc, conn);
    clearInterval(pingInterval);
  });

  conn.on('pong', () => {
    pongReceived = true;
  });

  // put the following in a variables in a block so the interval handlers don't keep them in
  // scope
  {
    // send sync step 1
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, doc);
    send(doc, conn, encoding.toUint8Array(encoder));
    const awarenessStates = doc.awareness.getStates();
    if (awarenessStates.size > 0) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(awarenessStates.keys())));
      send(doc, conn, encoding.toUint8Array(encoder));      
    }
  }
}

export const messageListener = async (conn: WebSocket, req: http.IncomingMessage, doc: WSSharedDoc, message: Uint8Array): Promise<void> => {
  // TODO: authenticate request
  const encoder = encoding.createEncoder();
  const decoder = decoding.createDecoder(message);
  const messageType = decoding.readVarUint(decoder);
  switch (messageType) {
    case messageSync: {
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.readSyncMessage(decoder, encoder, doc, conn);
      
      if (encoding.length(encoder) > 1) {
        send(doc, conn, encoding.toUint8Array(encoder));
      }
  
      break;
    }
    case messageAwareness: {
      const update = decoding.readVarUint8Array(decoder);
      pub.publishBuffer(doc.awarenessChannel, Buffer.from(update));
      awarenessProtocol.applyAwarenessUpdate(doc.awareness, update , conn);
      break;
    }
    default: throw new Error('unreachable');
  }
}

export const getUpdates = async (doc: WSSharedDoc): Promise<DBUpdate[]> => {
  const updates = await knex<DBUpdate>('items').where('docname', doc.name).orderBy('id');

  if (updates.length >= updatesLimit) {
    const dbYDoc = new Y.Doc();
    
    dbYDoc.transact(() => {
      for (const u of updates) {
        Y.applyUpdate(dbYDoc, u.update);
      }
    });

    const [mergedUpdates] = await Promise.all([
      knex<DBUpdate>('items').insert({docname: doc.name, update: Y.encodeStateAsUpdate(dbYDoc)}).returning('*'),
      knex('items').where('docname', doc.name).whereIn('id', updates.map(({id}) => id)).delete()
    ]);

    return mergedUpdates;
  } else {
    return updates;
  }
}

export const persistUpdate = async (doc: WSSharedDoc, update: Uint8Array): Promise<void> => {
  await knex('items').insert({docname: doc.name, update});
}

export const getYDoc = (docname: string, gc=true): [WSSharedDoc, boolean] => {
  const existing = docs.get(docname);
  if (existing) {
    return [existing, false];
  }

  const doc = new WSSharedDoc(docname);
  doc.gc = gc;

  docs.set(docname, doc);

  return [doc, true];
}

export const closeConn = (doc: WSSharedDoc, conn: WebSocket): void => {
  const controlledIds = doc.conns.get(conn);
  if (controlledIds) {
    doc.conns.delete(conn);
    awarenessProtocol.removeAwarenessStates(doc.awareness, Array.from(controlledIds), null);
    
    if (doc.conns.size == 0) {
      doc.destroy();
      docs.delete(doc.name);
    }
  }

  conn.close();
}

export const send = (doc: WSSharedDoc, conn: WebSocket, m: Uint8Array): void => {
  if (conn.readyState !== wsReadyStateConnecting && conn.readyState !== wsReadyStateOpen) {
    closeConn(doc, conn);
  }

  try {
    conn.send(m, err => {
      if (err) {
        closeConn(doc, conn);
      }
    });
  } catch (e) {
    closeConn(doc, conn);
  }
}

export const propagateUpdate = (doc: WSSharedDoc, update: Uint8Array) => {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeUpdate(encoder, update);
  const message = encoding.toUint8Array(encoder);
  doc.conns.forEach((_, conn) => send(doc, conn, message));
}

export const updateHandler = async (update: Uint8Array, origin: any, doc: WSSharedDoc): Promise<void> => {
  let isOriginWSConn = origin instanceof WebSocket && doc.conns.has(origin);

  if (isOriginWSConn) {
    Promise.all([
      pub.publishBuffer(doc.name, Buffer.from(update)),
      pushDocUpdatesToQueue(doc, update)
    ]); // do not await

    propagateUpdate(doc, update);

    persistUpdate(doc, update)
      .catch((err) => {
        serverLogger.error(err);
        closeConn(doc, origin);
      })
    ;
  } else {
    propagateUpdate(doc, update);
  }
}

export class WSSharedDoc extends Y.Doc {
  name: string;
  awarenessChannel: string;
  mux: mutex.mutex;
  conns: Map<WebSocket, Set<number>>;
  awareness: awarenessProtocol.Awareness;

  constructor(name: string) {
    super();

    this.name = name;
    this.awarenessChannel = `${name}-awareness`
    this.mux = mutex.createMutex();
    this.conns = new Map();
    this.awareness = new awarenessProtocol.Awareness(this);

    const awarenessChangeHandler = ({added, updated, removed}: {added: number[], updated: number[], removed: number[]}, origin: any) => {
      const changedClients = added.concat(updated, removed);
      const connControlledIds = this.conns.get(origin);
      if (connControlledIds) {
        added.forEach(clientId => { connControlledIds.add(clientId); });
        removed.forEach(clientId => { connControlledIds.delete(clientId); });
      }

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients));
      const buff = encoding.toUint8Array(encoder);
      
      this.conns.forEach((_, c) => {
        send(this, c, buff);
      });
    }

    this.awareness.on('update', awarenessChangeHandler);
    this.on('update', updateHandler);

    sub.subscribe([this.name, this.awarenessChannel]).then(() => {
      sub.on('messageBuffer', (channel, update) => {
        const channelId = channel.toString();

        // update is a Buffer, Buffer is a subclass of Uint8Array, update can be applied
        // as an update directly

        if (channelId === this.name) {
          Y.applyUpdate(this, update, sub);
        } else if (channelId === this.awarenessChannel) {
          awarenessProtocol.applyAwarenessUpdate(this.awareness, update, sub);
        }
      })
    })
  }

  destroy() {
    super.destroy();
    sub.unsubscribe([this.name, this.awarenessChannel]);
  }
}