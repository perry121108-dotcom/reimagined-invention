export type RGB = [number, number, number];

function sqDist(a: RGB, b: RGB): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

export function kMeans(
  pixels: RGB[],
  k: number,
  maxIter = 25,
): { center: RGB; count: number }[] {
  if (pixels.length === 0) return [];
  k = Math.min(k, pixels.length);

  // k-means++ initialisation
  const centroids: RGB[] = [pixels[Math.floor(Math.random() * pixels.length)]];
  while (centroids.length < k) {
    const dists = pixels.map(p => Math.min(...centroids.map(c => sqDist(p, c))));
    const total = dists.reduce((s, d) => s + d, 0);
    let r = Math.random() * total;
    let chosen = pixels[pixels.length - 1];
    for (let i = 0; i < pixels.length; i++) {
      r -= dists[i];
      if (r <= 0) { chosen = pixels[i]; break; }
    }
    centroids.push(chosen);
  }

  const assignments = new Int32Array(pixels.length);

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (let i = 0; i < pixels.length; i++) {
      let minD = Infinity, best = 0;
      for (let j = 0; j < k; j++) {
        const d = sqDist(pixels[i], centroids[j]);
        if (d < minD) { minD = d; best = j; }
      }
      if (assignments[i] !== best) { assignments[i] = best; changed = true; }
    }
    if (!changed) break;

    const sums = Array.from({ length: k }, () => [0, 0, 0] as [number, number, number]);
    const counts = new Int32Array(k);
    for (let i = 0; i < pixels.length; i++) {
      const j = assignments[i];
      sums[j][0] += pixels[i][0];
      sums[j][1] += pixels[i][1];
      sums[j][2] += pixels[i][2];
      counts[j]++;
    }
    for (let j = 0; j < k; j++) {
      if (counts[j] > 0)
        centroids[j] = [sums[j][0] / counts[j], sums[j][1] / counts[j], sums[j][2] / counts[j]];
    }
  }

  const counts = new Int32Array(k);
  for (let i = 0; i < pixels.length; i++) counts[assignments[i]]++;
  return centroids.map((center, j) => ({ center, count: counts[j] }));
}

export function rgbToHex([r, g, b]: RGB): string {
  return (
    '#' +
    [r, g, b]
      .map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0'))
      .join('')
  );
}
