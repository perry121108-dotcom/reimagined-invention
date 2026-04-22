import { api } from './client';
import type { ClothingItem } from '../types';

export type AddItemPayload = {
  image_url?: string;
  name?: string;
  category: string;
  layer_order?: number | null;
  colors: { hex: string; ratio: number }[];
  fit_type?: string;
  silhouette?: string;
  material_key?: string;
  pattern_type?: string;
  drape_level?: string;
  style_tags?: string[];
  season_tags?: string[];
};

export const wardrobeApi = {
  list: (params?: { category?: string; season?: string }) => {
    const qs = params
      ? '?' +
        Object.entries(params)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}=${v}`)
          .join('&')
      : '';
    return api.get<{ items: ClothingItem[] }>(`/wardrobe${qs}`);
  },

  add: (payload: AddItemPayload) =>
    api.post<{ message: string; item: ClothingItem }>('/wardrobe', payload),

  remove: (id: number) => api.del<{ message: string }>(`/wardrobe/${id}`),
};
