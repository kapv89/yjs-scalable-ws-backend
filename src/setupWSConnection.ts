import { WebSocket, Data as WSData } from 'ws';
import http from 'http';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness.js'
import * as syncProtocol from 'y-protocols/sync.js';
import * as mutex from 'lib0/mutex';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import qs from 'qs';
import {pub, sub} from './pubsub.js';
import { getDocUpdatesFromQueue, pushDocUpdatesToQueue } from './redis.js';
import { DocAccessRes, getDocUpdates, postDocUpdate } from './apiClient.js';
import { serverLogger } from './logger/index.js';
import _ from 'lodash';
const {isString} = _;

const wsReadyStateConnecting = 0
const wsReadyStateOpen = 1
const wsReadyStateClosing = 2 // eslint-disable-line
const wsReadyStateClosed = 3 // eslint-disable-line

const updatesLimit = 50;

export const messageSync = 0;
export const messageAwareness = 1;

export const pingTimeout = 30000;

export const docs = new Map<string, WSSharedDoc>();

export const connAccesses = new Map<WebSocket, ConnAccess>();

export class InvalidReqError extends Error {
  constructor() {
    super('invalid ws req');
  }
}

export class ConnAccess {
  token: string;
  access: DocAccessRes['access'];

  constructor(token: string, access: DocAccessRes['access']) {
    this.token = token;
    this.access = access;
  }
}

export const getDocIdFromReq = (req: any): string => {
  const docId = req.url.slice(1).split('?')[0];
  
  if (!isString(docId)) {
    throw new InvalidReqError();
  }

  return docId
}

export const getTokenFromReq = (req: any): string => {
  const [, query] = req.url.split('?');
  const data = qs.parse(query);
  const token = data.token;

  if (!isString(token)) {
    throw new InvalidReqError();
  }

  return token;
}

export function cleanup() {
  docs.forEach((doc) => {
    doc.conns.forEach((_, conn) => {
      closeConn(doc, conn);
    })
  })

  connAccesses.forEach((_, conn) => {
    connAccesses.delete(conn);
  });
}

export default async function setupWSConnection(conn: WebSocket, req: http.IncomingMessage, connAccess: ConnAccess): Promise<void> {
  conn.binaryType = 'arraybuffer';
  const docId: string = getDocIdFromReq(req);
  const [doc, isNew] = getYDoc(docId);
  doc.conns.set(conn, new Set());
  connAccesses.set(conn, connAccess);
  
  conn.on('message', (message: WSData) => {
    messageListener(conn, req, doc, new Uint8Array(message as ArrayBuffer));
  });

  if (isNew) {
    const persistedUpdates = await getDocUpdates(doc.id, connAccess.token);
    const dbYDoc = new Y.Doc();

    dbYDoc.transact(() => {
      for (const u of persistedUpdates) {
        Y.applyUpdate(dbYDoc, u);
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
      const connAccess = connAccesses.get(conn);

      if (connAccess && connAccess.access === 'rw') {
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.readSyncMessage(decoder, encoder, doc, conn);
        
        if (encoding.length(encoder) > 1) {
          send(doc, conn, encoding.toUint8Array(encoder));
        }
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

export const getYDoc = (docId: string, gc=true): [WSSharedDoc, boolean] => {
  const existing = docs.get(docId);
  if (existing) {
    return [existing, false];
  }

  const doc = new WSSharedDoc(docId);
  doc.gc = gc;

  docs.set(docId, doc);

  return [doc, true];
}

export const closeConn = (doc: WSSharedDoc, conn: WebSocket): void => {
  const controlledIds = doc.conns.get(conn);
  if (controlledIds) {
    doc.conns.delete(conn);
    awarenessProtocol.removeAwarenessStates(doc.awareness, Array.from(controlledIds), null);
    
    if (doc.conns.size === 0) {
      doc.destroy();
      docs.delete(doc.id);
    }
  }

  connAccesses.delete(conn);

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

export const updateHandler = async (update: Uint8Array, origin: any, doc: WSSharedDoc): Promise<void> => {
  let isOriginWSConn = origin instanceof WebSocket && doc.conns.has(origin);

  const propagateUpdate = () => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);
    doc.conns.forEach((_, conn) => send(doc, conn, message));
  };

  if (isOriginWSConn) {
    Promise.all([
      pub.publishBuffer(doc.id, Buffer.from(update)),
      pushDocUpdatesToQueue(doc, update)
    ]).catch((err) => {
      serverLogger.error(err);
    }); // do not await

    propagateUpdate();

    const connAccess = connAccesses.get(origin);
    if (connAccess && connAccess.access === 'rw') {
      postDocUpdate(doc.id, update, connAccess.token)
        .catch(() => {
          closeConn(doc, origin);
        })
    }
  } else {
    propagateUpdate();
  }
}

export class WSSharedDoc extends Y.Doc {
  id: string;
  awarenessChannel: string;
  mux: mutex.mutex;
  conns: Map<WebSocket, Set<number>>;
  awareness: awarenessProtocol.Awareness;

  constructor(id: string) {
    super();

    this.id = id;
    this.awarenessChannel = `${id}-awareness`
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

    sub.subscribe([this.id, this.awarenessChannel]).then(() => {
      sub.on('messageBuffer', (channel, update) => {
        const channelId = channel.toString();

        // update is a Buffer, Buffer is a subclass of Uint8Array, update can be applied
        // as an update directly

        if (channelId === this.id) {
          Y.applyUpdate(this, update, sub);
        } else if (channelId === this.awarenessChannel) {
          awarenessProtocol.applyAwarenessUpdate(this.awareness, update, sub);
        }
      })
    })
  }

  destroy() {
    super.destroy();
    sub.unsubscribe(this.id);
  }
}