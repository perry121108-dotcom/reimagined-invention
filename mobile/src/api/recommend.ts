import { api } from './client';
import type {
  RecommendResponse,
  ColdStartSimple,
  ColdStartColorGuide,
  OccasionMeta,
  Season,
  Occasion,
} from '../types';

export const recommendApi = {
  getOccasions: () => api.get<{ occasions: OccasionMeta[] }>('/meta/occasions'),

  recommend: (params: { occasion: Occasion; season: Season; top_n?: number }) =>
    api.post<RecommendResponse | ColdStartSimple | ColdStartColorGuide>('/recommend', params),
};
