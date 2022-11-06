import nock from 'nock';
import { WebsocketProvider } from 'y-websocket';
import config from "../config.js";

export class NoBCWebsocketProvider extends WebsocketProvider {
  connectBc() {
    // making this a no-op to avoid broadcast-channel based communication
    // b/w docs in tests
    return;
  }
}

export const wsUrl = (): string => `ws://${config.server.host}:${config.server.port}`;

export const apiUrl = (path=''): string => {
  return `${config.api.base}${path}`;
}

export const nockActivate = (): void => {
  if (!nock.isActive) {
    nock.activate();
  }
}

export const nockCleanAll = (): void => {
  nock.cleanAll();
}

export const nockSetRWAccess = (tokens: string[], docId: string): void => {
  nock(apiUrl(), {
    reqheaders: {
      authorization: val => tokens.map(t => `Bearer ${t}`).includes(val)
    }
  }).get(`/documents/${docId}/access`)
    .reply(200, {access: 'rw'})
    .persist(true)
  ;
}

export const nockSetRAccess = (tokens: string[], docId: string): void => {
  nock(apiUrl(), {
    reqheaders: {
      authorization: val => tokens.map(t => `Bearer ${t}`).includes(val)
    }
  }).get(`/documents/${docId}/access`)
    .reply(200, {access: 'r'})
    .persist(true)
  ;
}

export const nockGetUpdates = (tokens: string[], docId: string, updates: string[]): void => {
  nock(apiUrl(), {
    reqheaders: {
      authorization: val => tokens.map(t => `Bearer ${t}`).includes(val)
    }
  }).get(`/documents/${docId}/updates`)
    .reply(200, () => ({updates}))
    .persist(true)
  ;
}

export const nockPostUpdate = (tokens: string[], docId: string, updates: string[]): void => {
  nock(apiUrl(), {
    reqheaders: {
      authorization: val => tokens.map(t => `Bearer ${t}`).includes(val)
    }
  }).post(`/documents/${docId}/updates`, (body) => {
    updates.push(body.data);
    return true;
  }).reply(200, {msg: 'done'})
    .persist(true)
  ;
}