import nock from 'nock';
import config from "../config.js";

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

export const nockGetUpdates = (docId: string, updates: string[]): void => {
  nock(apiUrl(), {}).get(`/documents/${docId}/updates`)
    .reply(200, {updates})
    .persist(true)
  ;
}

export const nockPostUpdate = (docId: string, updates: string[]): void => {
  nock(apiUrl(), {}).post(`/documents/${docId}/updates`, (body) => {
    updates.push(body.data);
    return true;
  }).reply(200, {updates})
    .persist(true)
  ;
}