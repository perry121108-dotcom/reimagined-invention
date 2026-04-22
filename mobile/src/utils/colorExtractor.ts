import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import type { ColorEntry } from '../types';
import { kMeans, rgbToHex, type RGB } from './kmeans';

export async function extractColors(imageUri: string, k = 3): Promise<ColorEntry[]> {
  const small = await manipulateAsync(
    imageUri,
    [{ resize: { width: 50, height: 50 } }],
    { format: SaveFormat.PNG, base64: true },
  );
  if (!small.base64) return fallback();

  const pixels = decodePixels(small.base64);
  if (pixels.length === 0) return fallback();

  // Sample every 3rd pixel (~833 samples from 2500)
  const sampled: RGB[] = [];
  for (let i = 0; i < pixels.length; i += 3) sampled.push(pixels[i]);

  const clusters = kMeans(sampled, Math.min(k, sampled.length));
  const total = clusters.reduce((s, c) => s + c.count, 0);

  return clusters
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .map(c => ({
      hex: rgbToHex(c.center),
      ratio: Math.round((c.count / total) * 100) / 100,
    }));
}

export async function processForStorage(imageUri: string): Promise<string> {
  const result = await manipulateAsync(
    imageUri,
    [{ resize: { width: 200, height: 200 } }],
    { format: SaveFormat.WEBP, compress: 0.85 },
  );
  return result.uri;
}

function decodePixels(base64: string): RGB[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const UPNG = require('upng-js');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Buffer } = require('buffer');
    const buf: Buffer = Buffer.from(base64, 'base64');
    // UPNG.decode needs a plain ArrayBuffer; slice() copies the relevant portion
    const decoded = UPNG.decode(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const frames: ArrayBuffer[] = UPNG.toRGBA8(decoded);
    if (!frames?.length) return [];
    const rgba = new Uint8Array(frames[0]);
    const out: RGB[] = [];
    for (let i = 0; i < rgba.length; i += 4) out.push([rgba[i], rgba[i + 1], rgba[i + 2]]);
    return out;
  } catch {
    return [];
  }
}

function fallback(): ColorEntry[] {
  return [{ hex: '#808080', ratio: 1 }];
}
