/**
 * WARDROBE AI — 廓形評分模組
 * engine/silhouette_scorer.js
 * 零 AI API，純規則庫查表
 */

// ─────────────────────────────────────────
// 廓形組合評分靜態規則
// ─────────────────────────────────────────
const SILHOUETTE_COMBOS = {
  // key: `${topSil}_x_${bottomSil}`
  slim_x_wide_leg:   { score: 10, principle: 'fitted_x_volume', note: '最經典比例，各場合皆適用' },
  slim_x_a_line:     { score: 9,  principle: 'fitted_x_volume', note: '修身+A字裙，優雅女性線條' },
  slim_x_maxi:       { score: 9,  principle: 'fitted_x_volume', note: '修身+長裙，高挑顯瘦' },
  slim_x_slim_fit:   { score: 6,  principle: 'tonal',           note: '全修身需靠材質或色彩創造層次' },
  cropped_x_wide_leg:{ score: 10, principle: 'fitted_x_volume', note: '短版+闊腿褲，近年最流行比例' },
  cropped_x_a_line:  { score: 9,  principle: 'fitted_x_volume', note: '短版+A字裙，甜美有層次' },
  cropped_x_maxi:    { score: 8,  principle: 'fitted_x_volume', note: '短版+長裙，極端比例創造時髦感' },
  oversized_x_slim_fit: { score: 9, principle: 'fitted_x_volume', note: 'oversize+窄管，當代流行比例' },
  oversized_x_pencil:   { score: 8, principle: 'fitted_x_volume', note: 'oversize+包臀，強烈對比' },
  oversized_x_wide_leg: { score: 5, principle: 'tonal',           note: '全寬鬆易顯邋遢，需腰帶或tucked in' },
  oversized_x_a_line:   { score: 4, principle: 'contrast',        note: '上下均寬鬆，視覺重量失衡' },
  regular_x_wide_leg:   { score: 8, principle: 'fitted_x_volume', note: '基本百搭組合' },
  regular_x_a_line:     { score: 8, principle: 'fitted_x_volume', note: '基本百搭組合' },
  regular_x_straight:   { score: 7, principle: 'tonal',           note: '基本中性組合，不出錯但不突出' },
  wrap_x_slim_fit:  { score: 9,  principle: 'fitted_x_volume', note: 'wrap收腰+窄管，展現腰線' },
  wrap_x_pencil:    { score: 9,  principle: 'fitted_x_volume', note: 'wrap+鉛筆裙，強調沙漏比例' },
  peplum_x_slim_fit:{ score: 9,  principle: 'fitted_x_volume', note: 'peplum天生配窄版下身' },
  peplum_x_pencil:  { score: 9,  principle: 'fitted_x_volume', note: '腰部荷葉+包臀，強調沙漏' },
  off_shoulder_x_wide_leg: { score: 7, principle: 'fitted_x_volume', note: '露肩+闊腿，注意腰線定義' },
};

// 廓形×體型規則
const BODY_RULES = {
  upper_heavy: {
    top_recommended:  ['regular','slim','wrap'],
    top_avoid:        ['oversized','peplum','off_shoulder'],
    bottom_recommended: ['wide_leg','a_line','straight'],
    bottom_avoid:     ['pencil','slim_fit'],
  },
  pear_shape: {
    top_recommended:  ['oversized','peplum','off_shoulder','cropped'],
    top_avoid:        ['slim','wrap'],
    bottom_recommended: ['a_line','wide_leg','maxi'],
    bottom_avoid:     ['pencil','slim_fit','mini'],
  },
  balanced: {
    top_recommended:  [],
    top_avoid:        [],
    bottom_recommended: [],
    bottom_avoid:     [],
  },
};

// 廓形×場合適配
const OCCASION_RULES = {
  work_interview:   { tops: ['regular','slim','wrap'],            bottoms: ['straight','slim_fit','pencil'] },
  work_presentation:{ tops: ['slim','regular'],                   bottoms: ['pencil','straight'] },
  work_creative:    { tops: ['oversized','regular','cropped'],    bottoms: ['wide_leg','a_line','straight'] },
  work_daily:       { tops: ['regular','slim','wrap'],            bottoms: ['straight','wide_leg','slim_fit'] },
  date_first:       { tops: ['wrap','off_shoulder','slim','peplum'], bottoms: ['a_line','pencil'] },
  date_casual:      { tops: ['regular','oversized','cropped'],    bottoms: ['a_line','wide_leg','mini'] },
  casual:           { tops: ['oversized','regular','cropped'],    bottoms: ['wide_leg','straight','a_line'] },
  outdoor:          { tops: ['regular','oversized'],              bottoms: ['straight','wide_leg'] },
  party:            { tops: ['off_shoulder','slim','peplum','cropped'], bottoms: ['mini','pencil','maxi'] },
  sport:            { tops: ['regular','slim'],                   bottoms: ['straight','slim_fit'] },
};

// ─────────────────────────────────────────
// 廓形組合評分函式
// ─────────────────────────────────────────

/**
 * 評分上衣廓形 × 下身廓形的搭配
 */
function scoreSilhouetteCombo(topSilhouette, bottomSilhouette) {
  const key = `${topSilhouette}_x_${bottomSilhouette}`;
  const rule = SILHOUETTE_COMBOS[key];
  if (rule) {
    return { score: rule.score / 10, principle: rule.principle, note: rule.note };
  }
  // 未定義的組合：給中等分
  return { score: 0.6, principle: 'neutral', note: '標準搭配' };
}

/**
 * 廓形×體型加分
 */
function scoreSilhouetteBodyType(layers, bottom, bodyType) {
  if (!bodyType || bodyType === 'balanced') return { bonus: 0, warnings: [] };

  const rules = BODY_RULES[bodyType];
  if (!rules) return { bonus: 0, warnings: [] };

  const outerTop = layers[layers.length - 1];
  const topSil   = outerTop.silhouette || 'regular';
  const botSil   = bottom.silhouette   || 'straight';

  let bonus = 0;
  const warnings = [];

  if (rules.top_recommended.length && rules.top_recommended.includes(topSil)) bonus += 0.5;
  if (rules.top_avoid.includes(topSil)) {
    bonus -= 0.8;
    warnings.push(`${topSil} 廓形不利於 ${bodyType} 體型的上半身修飾`);
  }
  if (rules.bottom_recommended.length && rules.bottom_recommended.includes(botSil)) bonus += 0.5;
  if (rules.bottom_avoid.includes(botSil)) {
    bonus -= 0.8;
    warnings.push(`${botSil} 廓形不利於 ${bodyType} 體型的下半身修飾`);
  }

  return { bonus, warnings };
}

/**
 * 廓形×場合加分
 */
function scoreSilhouetteOccasion(layers, bottom, occasion) {
  const rules = OCCASION_RULES[occasion];
  if (!rules) return { bonus: 0 };

  const topSil = (layers[layers.length - 1].silhouette) || 'regular';
  const botSil = bottom.silhouette || 'straight';

  let bonus = 0;
  if (rules.tops.includes(topSil))    bonus += 0.3;
  if (rules.bottoms.includes(botSil)) bonus += 0.3;

  return { bonus };
}

// ─────────────────────────────────────────
// 主函式：廓形綜合評分
// ─────────────────────────────────────────

/**
 * @param {Array}  layers   - 上衣陣列（含 silhouette）
 * @param {object} bottom   - 下身（含 silhouette）
 * @param {string} bodyType - 'upper_heavy'|'pear_shape'|'balanced'
 * @param {string} occasion
 * @returns { silhouetteScore, principle, note, warnings }
 */
function scoreSilhouette(layers, bottom, bodyType, occasion) {
  const outerTop = layers[layers.length - 1];
  const topSil   = outerTop.silhouette || 'regular';
  const botSil   = bottom.silhouette   || 'straight';

  // 廓形組合基礎分（0-1）
  const combo     = scoreSilhouetteCombo(topSil, botSil);

  // 體型加分
  const bodyScore = scoreSilhouetteBodyType(layers, bottom, bodyType);

  // 場合加分
  const occScore  = scoreSilhouetteOccasion(layers, bottom, occasion);

  const total = (combo.score * 10) + bodyScore.bonus + occScore.bonus;

  return {
    silhouetteScore: Math.round(Math.min(total, 10) * 10) / 10,
    principle: combo.principle,
    note: combo.note,
    warnings: bodyScore.warnings,
  };
}

module.exports = { scoreSilhouette, scoreSilhouetteCombo, SILHOUETTE_COMBOS };
