import { api } from './client';
import type { ColorSeason, SkinTone, BodyType } from '../types';

export type ProfilePayload = {
  color_season?: ColorSeason;
  skin_tone?:    SkinTone;
  body_type?:    BodyType;
};

export const authApi = {
  updateProfile: (payload: ProfilePayload) =>
    api.patch<{ message: string }>('/auth/profile', payload),
};
