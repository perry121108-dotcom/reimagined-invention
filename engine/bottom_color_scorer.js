/**
 * WARDROBE AI — engine/bottom_color_scorer.js  v3.4
 * 下身顏色動態評分：四季群組 + 場合權重 + 黑色替代
 * 零 AI API，純靜態規則查表
 */

// ════════════════════════════════════════════════
// 四季群組下身顏色（含場合權重）
// ════════════════════════════════════════════════
const BOTTOM_COLORS = {
  // spring 群組
  khaki_beige:   { hex:'#D4B896', group:'spring', blackReplace:2,
    weights:{ casual:1.2, date_casual:1.2, outdoor:1.0, work_daily:0.8 } },
  light_denim:   { hex:'#A8C5DA', group:'spring', blackReplace:1,
    weights:{ casual:1.3, date_casual:1.3, outdoor:1.0, work_daily:0.5 } },
  apricot:       { hex:'#F5D5B0', group:'spring', blackReplace:2,
    weights:{ casual:1.1, date_casual:1.3, outdoor:0.8 } },
  peach_beige:   { hex:'#F2C9A8', group:'spring', blackReplace:2,
    weights:{ casual:1.0, date_casual:1.2 } },

  // summer 群組
  dusty_blue:    { hex:'#8FA8BE', group:'summer', blackReplace:3,
    weights:{ work_daily:1.3, work_interview:1.2, casual:1.1, work_creative:1.2 } },
  light_grey:    { hex:'#C8C8C8', group:'summer', blackReplace:3,
    weights:{ casual:1.2, work_daily:1.1, sport:1.3, work_creative:1.0 } },
  cool_cocoa:    { hex:'#A08878', group:'summer', blackReplace:2,
    weights:{ casual:1.1, work_daily:1.0, date_casual:1.0 } },
  medium_denim:  { hex:'#6A8FAF', group:'summer', blackReplace:1,
    weights:{ casual:1.2, date_casual:1.1, outdoor:1.1 } },

  // autumn 群組
  mocha:         { hex:'#7C5C4A', group:'autumn', blackReplace:3,
    weights:{ casual:1.2, work_daily:1.3, date_casual:1.1, outdoor:0.8 } },
  olive_green:   { hex:'#6B7A3A', group:'autumn', blackReplace:2,
    weights:{ outdoor:1.4, casual:1.2, work_creative:1.2, work_daily:0.7, work_interview:0.3 } },
  caramel:       { hex:'#C4722A', group:'autumn', blackReplace:2,
    weights:{ casual:1.1, date_casual:1.2, outdoor:1.0 } },
  deep_khaki:    { hex:'#8B7355', group:'autumn', blackReplace:2,
    weights:{ outdoor:1.3, casual:1.1, work_creative:1.0, work_daily:0.9 } },

  // winter 群組
  navy:          { hex:'#1F3A5F', group:'winter', blackReplace:3,
    weights:{ work_interview:1.4, work_presentation:1.4, work_daily:1.3, formal:1.3, casual:1.0 } },
  charcoal:      { hex:'#3D3D3D', group:'winter', blackReplace:3,
    weights:{ work_daily:1.3, work_interview:1.2, casual:1.2, party:1.1 } },
  burgundy:      { hex:'#722F37', group:'winter', blackReplace:2,
    weights:{ date_first:1.3, party:1.2, casual:1.0, work_daily:0.6 } },
  raw_denim:     { hex:'#2B3A52', group:'winter', blackReplace:2,
    weights:{ casual:1.2, work_creative:1.2, date_casual:1.1, work_daily:1.0 } },

  // 通用（正式場合保留黑）
  black_formal:  { hex:'#000000', group:null, blackReplace:0,
    weights:{ work_interview:1.0, work_presentation:1.0, formal:1.5, party:1.2,
              casual:0.3, work_daily:0.4 } },
};

// 黑色場合權重
const BLACK_WEIGHTS = {
  work_interview:    1.0,
  work_presentation: 1.0,
  formal:            1.5,
  party:             1.2,
  funeral:           2.0,
  work_daily:        0.4,
  work_creative:     0.3,
  casual:            0.3,
  date_first:        0.5,
  date_casual:       0.4,
  outdoor:           0.2,
  sport:             0.6,
};

// 下身非黑→上身避免規則
const BOTTOM_TOP_AVOID = {
  olive_green:  { avoid:['khaki','army_green'], recommend:['#FFFDD0','#D3D3D3','#F5F5DC'] },
  navy:         { avoid:['dark_blue','black'],  recommend:['#E8E8E8','#F8C8C0','#FFFFFF'] },
  mocha:        { avoid:['brown_similar'],      recommend:['#FFFDD0','#F5EBD8','#C8E8D8'] },
  dusty_blue:   { avoid:['grey_blue'],          recommend:['#FFFFFF','#FFF8DC','#F0F0F0'] },
  khaki_beige:  { avoid:['beige_similar'],      recommend:['#FFFFFF','#4169E1','#CC0000'] },
  burgundy:     { avoid:['red_similar'],        recommend:['#000000','#F5F5DC','#D3D3D3'] },
};

// 色季→建議下身群組優先順序
const SEASON_BOTTOM_PRIORITY = {
  bright_spring: ['spring','autumn'],
  true_spring:   ['spring','autumn'],
  light_spring:  ['spring'],
  light_summer:  ['summer'],
  true_summer:   ['summer'],
  soft_summer:   ['summer','winter'],
  soft_autumn:   ['autumn'],
  true_autumn:   ['autumn'],
  deep_autumn:   ['autumn','winter'],
  deep_winter:   ['winter'],
  true_winter:   ['winter'],
  bright_winter: ['winter'],
};

// ════════════════════════════════════════════════
// 主評分函式
// ════════════════════════════════════════════════

/**
 * 計算下身顏色的場合適配分
 * @param {object} bottom   - { hsl_h, hsl_s, hsl_l, material_key }
 * @param {string} occasion - 場合 key
 * @param {string} colorSeason - 用戶色季
 * @returns { occasionScore, blackPenalty, seasonBonus, colorKey, tips }
 */
function scoreBottomColor(bottom, occasion, colorSeason) {
  const s = bottom.hsl_s ?? 0;
  const h = bottom.hsl_h ?? 0;
  const l = bottom.hsl_l ?? 50;

  let occasionScore = 1.0;  // 預設基準
  let blackPenalty  = 0;
  let seasonBonus   = 0;
  const tips = [];

  // 1. 判斷是否為黑色
  const isBlack = s < 10 && l < 25;

  if (isBlack) {
    const blackWeight = BLACK_WEIGHTS[occasion] || 0.5;
    occasionScore = blackWeight;

    if (blackWeight < 0.5) {
      blackPenalty = -0.5;
      tips.push('此場合建議使用色季替代色而非黑色');
    }
    return { occasionScore, blackPenalty, seasonBonus, colorKey: 'black', tips };
  }

  // 2. 找最匹配的顏色 key
  const colorKey = findClosestColorKey(h, s, l);
  const colorRule = BOTTOM_COLORS[colorKey];

  if (colorRule) {
    // 場合加權
    const occasionWeight = colorRule.weights[occasion] || 0.9;
    occasionScore = occasionWeight;

    // 3. 色季群組加分
    const priorityGroups = SEASON_BOTTOM_PRIORITY[colorSeason] || [];
    if (colorRule.group && priorityGroups.includes(colorRule.group)) {
      seasonBonus = 0.3;
      tips.push(`${colorRule.group} 群組顏色符合你的色季`);
    }

    // 4. 黑色替代強度加分（強替代 = 更好的選擇）
    if (colorRule.blackReplace >= 3) {
      seasonBonus += 0.2;
      tips.push('優質黑色替代色，顯瘦效果佳');
    }
  }

  return {
    occasionScore: Math.round(occasionScore * 10) / 10,
    blackPenalty,
    seasonBonus: Math.round(seasonBonus * 10) / 10,
    colorKey,
    tips,
  };
}

/**
 * 計算上下身顏色協同性
 * 下身非黑 → 上身避免同色系
 */
function scoreTopBottomHarmony(bottom, topLayer) {
  const bottomKey = findClosestColorKey(
    bottom.hsl_h || 0, bottom.hsl_s || 0, bottom.hsl_l || 50
  );
  const avoidRule = BOTTOM_TOP_AVOID[bottomKey];
  if (!avoidRule) return { bonus: 0, warning: null };

  const topH = topLayer.hsl_h || 0;
  const topS = topLayer.hsl_s || 0;

  // 上身是否落在推薦顏色附近（簡化版：色相差 < 30 且飽和度相近）
  const topHex = topLayer.colors?.[0]?.hex || '#808080';
  const isRecommended = avoidRule.recommend.some(recHex => {
    const recH = hexToHslSimple(recHex).h;
    const diff  = Math.abs(topH - recH);
    return Math.min(diff, 360 - diff) < 40;
  });

  if (isRecommended) {
    return { bonus: 0.3, warning: null };
  }

  // 上身是否在避免清單（色相差很小）
  const bottomH = bottom.hsl_h || 0;
  const hueDiff = Math.abs(topH - bottomH);
  const normalizedDiff = hueDiff > 180 ? 360 - hueDiff : hueDiff;

  if (normalizedDiff < 25 && topS > 20) {
    return {
      bonus: -0.3,
      warning: `上下身色相過近，建議上身換成：${avoidRule.recommend.map(h => h).join('、')}`
    };
  }

  return { bonus: 0, warning: null };
}

// ════════════════════════════════════════════════
// 工具函式
// ════════════════════════════════════════════════

function hexToHslSimple(hex) {
  let r = parseInt(hex.slice(1,3),16)/255;
  let g = parseInt(hex.slice(3,5),16)/255;
  let b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h = 0, s = 0, l = (max+min)/2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    switch(max) {
      case r: h = ((g-b)/d + (g<b?6:0))/6; break;
      case g: h = ((b-r)/d + 2)/6; break;
      case b: h = ((r-g)/d + 4)/6; break;
    }
  }
  return { h: h*360, s: s*100, l: l*100 };
}

/**
 * 找最接近的顏色 key（色相差最小）
 */
function findClosestColorKey(h, s, l) {
  let best = null, bestDiff = Infinity;
  for (const [key, rule] of Object.entries(BOTTOM_COLORS)) {
    if (key === 'black_formal') continue;
    const ruleHsl = hexToHslSimple(rule.hex);
    const hueDiff = Math.abs(h - ruleHsl.h);
    const normDiff = Math.min(hueDiff, 360 - hueDiff);
    const satDiff  = Math.abs(s - ruleHsl.s);
    const lightDiff = Math.abs(l - ruleHsl.l);
    const total = normDiff * 0.5 + satDiff * 0.3 + lightDiff * 0.2;
    if (total < bestDiff) { bestDiff = total; best = key; }
  }
  return best || 'charcoal';
}

/**
 * 根據色季查詢黑色替代色
 */
function getBlackReplacement(colorSeason, occasion) {
  const groups = SEASON_BOTTOM_PRIORITY[colorSeason] || ['winter'];
  const primaryGroup = groups[0];

  // 找該色季群組中，場合權重最高的替代色
  let best = null, bestScore = 0;
  for (const [key, rule] of Object.entries(BOTTOM_COLORS)) {
    if (key === 'black_formal') continue;
    if (rule.group !== primaryGroup) continue;
    const score = (rule.weights[occasion] || 0.9) * rule.blackReplace;
    if (score > bestScore) { bestScore = score; best = { key, ...rule }; }
  }
  return best;
}

module.exports = {
  scoreBottomColor,
  scoreTopBottomHarmony,
  getBlackReplacement,
  BOTTOM_COLORS,
  SEASON_BOTTOM_PRIORITY,
  BLACK_WEIGHTS,
};
