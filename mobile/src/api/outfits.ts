import { api } from './client';
import type { Occasion, Season } from '../types';

export type OutfitRecord = {
  id: number;
  worn_date: string;
  occasion?: Occasion;
  season?: Season;
  layer_ids?: number[];
  bottom_id?: number;
  accessory_ids?: number[];
  hat_color_hex?: string;
  shoes_color_hex?: string;
  bag_color_hex?: string;
  user_score?: number;
  is_ai_suggested?: boolean;
};

export type PostOutfitPayload = {
  worn_date: string;
  occasion?: Occasion;
  season?: Season;
  layer_ids?: number[];
  bottom_id?: number;
  hat_color_hex?: string;
  shoes_color_hex?: string;
  bag_color_hex?: string;
  user_score?: number;
  is_ai_suggested?: boolean;
};

export const outfitsApi = {
  list: (params?: { from?: string; to?: string; occasion?: string }) => {
    const qs = params
      ? '?' + Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join('&')
      : '';
    return api.get<{ records: OutfitRecord[] }>(`/outfits${qs}`);
  },

  add: (payload: PostOutfitPayload) =>
    api.post<{ message: string }>('/outfits', payload),

  feedback: (rule_name: string, action: 'like' | 'dislike') =>
    api.post<{ message: string }>('/outfits/feedback', { rule_name, action }),
};
