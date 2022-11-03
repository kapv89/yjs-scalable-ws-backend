import axios from 'axios';
import {Base64} from 'js-base64';

import config from './config.js';

const apiClient = axios.create({
  baseURL: config.api.base
});

export default apiClient;

interface GetDocUpdatesRes {
  updates: string[];
}

export const getDiagramUpdates = async (diagramId: string) => {
  const res = await apiClient.get<GetDocUpdatesRes>(`/documents/${diagramId}/updates`)
  return res.data.updates.map((s) => Base64.toUint8Array(s));
}

export const postDiagramUpdate = async (diagramId: string, update: Uint8Array) => {
  await apiClient.post(
    `/documents/${diagramId}/updates`,
    {data: Base64.fromUint8Array(update)},
    {}
  );
}