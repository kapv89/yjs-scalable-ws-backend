import axios from 'axios';
import {Base64} from 'js-base64';

import config from './config.js';

const apiClient = axios.create({
  baseURL: config.api.base
});

export default apiClient;

export type DocAccessRes = {
  access: 'r' | 'rw' | null
}

export const getDocAccess = async (docId: string, token: string) => {
  const res = await apiClient.get<DocAccessRes>(`/documents/${docId}/access`, {headers: {Authorization: `Bearer ${token}`}});
  return res.data.access;
}

export type GetDocUpdatesRes = {
  updates: string[];
}

export const getDocUpdates = async (docId: string, token: string) => {
  const res = await apiClient.get<GetDocUpdatesRes>(`/documents/${docId}/updates`, {headers: {Authorization: `Bearer ${token}`}})
  return res.data.updates.map((s) => Base64.toUint8Array(s));
}

export type PostDocUpdateData = {
  data: string
}

export const postDocUpdate = async (docId: string, update: Uint8Array, token: string) => {
  await apiClient.post<PostDocUpdateData>(
    `/documents/${docId}/updates`,
    {data: Base64.fromUint8Array(update)},
    {headers: {Authorization: `Bearer ${token}`}}
  );
}