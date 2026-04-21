/**
 * WARDROBE AI — 市場現實版評分調整補丁  v3.3
 * 整合進 engine/recommender.js 的 scoreOutfit 函式
 *
 * 新增三條評分規則：
 * 1. 下身高飽和懲罰（-0.5）
 * 2. 60-30-10 比例獎勵（+0.5）
 * 3. 材質×顏色視覺規則懲罰（-1.0）
 */

// ════════════════════════════════════════════════
// 材質×顏色視覺規則（同步自 material_color_visual_rules 表）
// ════════════════════════════════════════════════
const MATERIAL_COLOR_VISUAL = {
  // [material_key]: { high_sat: recommended, neutral: recommended, earth: recommended, pastel: recommended }
  velvet:        { high_sat: false, neutral: true,  earth: true,  pastel: false },
  leather_patent:{ high_sat: false, neutral: true,  earth: false, pastel: false },
  silk_satin:    { high_sat: false, neutral: true,  earth: false, pastel: true  },
  wool_coarse:   { high_sat: false, neutral: true,  earth: true,  pastel: false },
  linen:         { high_sat: false, neutral: true,  earth: true,  pastel: false },
  knit_chunky:   { high_sat: false, neutral: true,  earth: true,  pastel: true  },
  // 其他材質較寬容
};

// 底著市場主流色（低飽和）
const MARKET_BOTTOM_COLORS = [
  '#000000','#3A3A3A','#808080','#1F3A5F',
  '#5B7FA6','#C2B280','#808000','#6B4423',
  '#722F37','#E8D5B7',
];

// ════════════════════════════════════════════════
// 顏色類型判定
// ════════════════════════════════════════════════

/**
 * 根據 HSL 判斷顏色類型
 * @param {number} s - 飽和度 0-100
 * @param {number} h - 色相 0-360
 * @param {number} l - 明度 0-100
 * @returns 'high_sat' | 'neutral' | 'earth' | 'pastel'
 */
function getColorType(s, h, l) {
  if (s < 20 || l < 20)      return 'neutral';  // 無彩色/深色
  if (s < 40 && l > 65)      return 'pastel';   // 粉彩
  if (s >= 20 && s <= 55 &&  // 大地色：暖色相 + 中飽和 + 中明度
      h >= 20 && h <= 60 &&
      l >= 20 && l <= 65)    return 'earth';
  if (s > 60)                return 'high_sat'; // 高飽和鮮豔
  return 'neutral';
}

// ════════════════════════════════════════════════
// 三條新評分規則
// 整合進 scoreOutfit 函式的 colorScore 計算後
// ════════════════════════════════════════════════

/**
 * 市場現實版評分調整
 * @param {object} bottom  - 下身衣物 { hsl_h, hsl_s, hsl_l, material_key }
 * @param {Array}  layers  - 上衣陣列 { hsl_h, hsl_s, hsl_l }
 * @param {Array}  accessories - 配件（可選）
 * @returns { adjustment: number, bonuses: string[], penalties: string[] }
 */
function scoreMarketReality(bottom, layers, accessories = []) {
  let adjustment = 0;
  const bonuses  = [];
  const penalties = [];

  const bottomS = bottom.hsl_s || 0;
  const bottomH = bottom.hsl_h || 0;
  const bottomL = bottom.hsl_l || 50;
  const bottomType = getColorType(bottomS, bottomH, bottomL);

  const outerTop = layers[layers.length - 1];
  const topS     = outerTop.hsl_s || 0;

  // ─────────────────────────────────────────
  // 規則 1：下身高飽和懲罰
  // 高飽和下身（s > 60）不符合市場現實 + 顯瘦需求
  // ─────────────────────────────────────────
  if (bottomS > 60) {
    adjustment -= 0.5;
    penalties.push('高飽和下身不利顯瘦，且市場搭配性低');
  }

  // ─────────────────────────────────────────
  // 規則 2：60-30-10 比例獎勵
  // 中性下身（s < 35）+ 彩色上身（s > 40）→ 最高搭配率
  // ─────────────────────────────────────────
  if (bottomS < 35 && topS > 40) {
    adjustment += 0.5;
    bonuses.push('中性下身 + 彩色上身，符合 60-30-10 黃金比例');
  }

  // ─────────────────────────────────────────
  // 規則 3：材質×顏色視覺規則懲罰
  // 如 velvet + high_sat = 廉價感
  // ─────────────────────────────────────────
  const matKey = bottom.material_key || 'cotton';
  const matRule = MATERIAL_COLOR_VISUAL[matKey];

  if (matRule && matRule[bottomType] === false) {
    adjustment -= 1.0;
    penalties.push(`${matKey} 材質搭配 ${bottomType} 色系容易顯廉價，建議換成中性色或大地色`);
  }

  // ─────────────────────────────────────────
  // 規則 4（加分）：配件跳色獎勵（10% 點綴法）
  // ─────────────────────────────────────────
  if (accessories && accessories.length > 0) {
    const hasPopAccent = accessories.some(acc => (acc.hsl_s || 0) > 60);
    if (hasPopAccent && bottomS < 35) {
      adjustment += 0.3;
      bonuses.push('中性穿搭 + 高飽和配件點綴，符合 10% 跳色法則');
    }
  }

  return {
    adjustment: Math.round(adjustment * 10) / 10,
    bonuses,
    penalties,
  };
}

// ════════════════════════════════════════════════
// 整合方式（貼入 recommender.js 的 scoreOutfit 函式）
// ════════════════════════════════════════════════

/*
  // ── 在現有 scoreOutfit 函式中，finalColorScore 計算後加入 ──

  const { scoreMaterial }   = require('./material_scorer');
  const { scoreSilhouette } = require('./silhouette_scorer');
  const { scoreMarketReality } = require('./market_reality_scorer');  // ← 新增

  // ... 原本的色彩分計算 ...

  // 新增：市場現實分
  const marketResult = scoreMarketReality(bottom, layers, accessories);
  const adjustedColorScore = Math.min(10, Math.max(0,
    finalColorScore + marketResult.adjustment * 10 / 10
  ));

  // 最終三維加權（加入市場分）
  const finalScore =
    (adjustedColorScore / 10) * 0.45 +  // 色彩（含市場調整）
    (matResult.materialScore / 10) * 0.25 +
    (silResult.silhouetteScore / 10) * 0.20 +
    Math.max(0, marketResult.adjustment) * 0.10;  // 市場現實加分

  return {
    ...原本回傳的欄位,
    marketBonuses:  marketResult.bonuses,
    marketPenalties: marketResult.penalties,
  };
*/

module.exports = {
  scoreMarketReality,
  getColorType,
  MATERIAL_COLOR_VISUAL,
  MARKET_BOTTOM_COLORS,
};
