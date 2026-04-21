/**
 * WARDROBE AI — engine/recommender.js  v3.3
 * 推薦引擎：四維評分（色彩 × 材質 × 廓形 × 市場現實）
 * 零 AI API 費用，純規則庫查表
 *
 * 最終評分公式：
 *   調整後色彩分 × 0.45 + 材質分 × 0.25 + 廓形分 × 0.20 + 市場加分 × 0.10
 */

const { scoreMaterial, getPerceivedHsl } = require('./material_scorer');
const { scoreSilhouette }                = require('./silhouette_scorer');
const { scoreMarketReality }             = require('./market_reality_scorer');
const { scoreBottomColor, scoreTopBottomHarmony, getBlackReplacement } = require('./bottom_color_scorer');

// ════════════════════════════════════════════════
// 工具函式：色彩計算
// ════════════════════════════════════════════════

function hexToHsl(hex) {
  let r = parseInt(hex.slice(1,3),16)/255;
  let g = parseInt(hex.slice(3,5),16)/255;
  let b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max+min)/2;
  if (max===min) { h=s=0; } else {
    const d = max-min;
    s = l>0.5 ? d/(2-max-min) : d/(max+min);
    switch(max) {
      case r: h=((g-b)/d+(g<b?6:0))/6; break;
      case g: h=((b-r)/d+2)/6; break;
      case b: h=((r-g)/d+4)/6; break;
    }
  }
  return { h:h*360, s:s*100, l:l*100 };
}

function hueDiff(hex1, hex2) {
  const h1 = hexToHsl(hex1).h;
  const h2 = hexToHsl(hex2).h;
  const diff = Math.abs(h1-h2);
  return diff>180 ? 360-diff : diff;
}

function isAchromatic(hex) {
  const { s, l } = hexToHsl(hex);
  // L>90 涵蓋近白色（象牙白、亞麻白等），數學飽和度高但視覺中性
  return s<15 || (s<30 && (l>85 || l<20)) || l>90;
}

function isEarthTone(hex) {
  const { h, s, l } = hexToHsl(hex);
  // L 上限放寬至 72 以涵蓋棕褐米（#DEB887, L:70%）等大地色
  return (h>=20 && h<=50 && s>=15 && s<=60 && l>=20 && l<=72);
}

function getMainColor(item) {
  if (!item.colors || item.colors.length===0) return '#808080';
  const sorted = [...item.colors].sort((a,b) => (b.ratio||0)-(a.ratio||0));
  return sorted[0].hex;
}

// ════════════════════════════════════════════════
// 三維色彩評分（v3.0 強化版）
// ════════════════════════════════════════════════

/**
 * 計算兩色的色彩評分（考慮色相、飽和度、明度）
 */
function calcColorScore(hex1, hex2, season = 'spring') {
  // 無彩色特判
  if (isAchromatic(hex1) || isAchromatic(hex2)) {
    return { score: 8, rule: '無彩色', reason: '無彩色搭配任何顏色都和諧' };
  }
  // 大地色系特判
  if (isEarthTone(hex1) && isEarthTone(hex2)) {
    return { score: 8, rule: '大地色系', reason: '大地色系自然融合' };
  }

  const hsl1 = hexToHsl(hex1);
  const hsl2 = hexToHsl(hex2);
  const diff = hueDiff(hex1, hex2);

  // 色相基礎分
  let hueScore, rule, reason;
  if (diff<=15)       { hueScore=7; rule='同色系';  reason='深淺搭配，顯高顯瘦'; }
  else if (diff<=60)  { hueScore=8; rule='鄰近色';  reason='和諧溫柔有層次'; }
  else if (diff<=120) { hueScore=5; rule='中間色';  reason='色相差中等，略衝突'; }
  else if (diff<=150) { hueScore=8; rule='對比色';  reason='活潑醒目有力量感'; }
  else                { hueScore=9; rule='互補色';  reason='戲劇感強，建議點綴法'; }

  // 飽和度調整（差>40 → 避免兩鮮色相撞）
  const satDiff = Math.abs(hsl1.s - hsl2.s);
  const satAdj  = satDiff > 40 ? -1 : 0;

  // 明度對比分（差20-50最佳）
  const lightDiff = Math.abs(hsl1.l - hsl2.l);
  const lightAdj  = lightDiff >= 20 && lightDiff <= 50 ? 1
                  : lightDiff < 10 ? -0.5 : 0;

  // 三維加權
  const score = hueScore*0.5 + (hueScore+satAdj)*0.3 + (hueScore+lightAdj)*0.2;

  return {
    score: Math.min(10, Math.max(0, Math.round(score*10)/10)),
    rule, reason
  };
}

// ════════════════════════════════════════════════
// 多層上衣組合（含剪枝）
// ════════════════════════════════════════════════

function buildLayerCombos(tops) {
  const byLayer = { 1:[], 2:[], 3:[] };
  tops.forEach(t => {
    const l = t.layer_order || 2;
    if (byLayer[l]) byLayer[l].push(t);
  });

  // 每層最多取 10 件（剪枝）
  Object.keys(byLayer).forEach(k => {
    if (byLayer[k].length > 10) byLayer[k] = byLayer[k].slice(0, 10);
  });

  const combos = [];
  byLayer[2].forEach(t => combos.push([t]));
  byLayer[1].forEach(i => byLayer[2].forEach(m => combos.push([i,m])));
  byLayer[2].forEach(m => byLayer[3].forEach(o => combos.push([m,o])));
  byLayer[1].forEach(i => byLayer[2].forEach(m => byLayer[3].forEach(o => combos.push([i,m,o]))));

  // 總候選上限 300 套
  return combos.slice(0, 300);
}

// ════════════════════════════════════════════════
// 動態季節權重
// ════════════════════════════════════════════════

function getSeasonWeights(season) {
  return ['autumn','winter'].includes(season)
    ? { outerWeight: 0.70, innerWeight: 0.30 }
    : { outerWeight: 0.55, innerWeight: 0.45 };
}

// ════════════════════════════════════════════════
// 整套穿搭評分（三維）
// ════════════════════════════════════════════════

function scoreOutfit(layers, bottom, occasion, season, bodyType, userPrefs = {}) {
  const outerTop = layers[layers.length-1];
  const { outerWeight, innerWeight } = getSeasonWeights(season);

  // ── 色彩評分（使用材質修正後的感知 HSL）──
  const topColor    = getMainColor(outerTop);
  const bottomColor = getMainColor(bottom);
  const mainPair    = calcColorScore(topColor, bottomColor, season);

  let innerColorScore = mainPair.score;
  if (layers.length > 1) {
    const innerScores = layers.slice(0,-1).map(l => {
      const ic = getMainColor(l);
      return calcColorScore(ic, topColor, season).score;
    });
    innerColorScore = innerScores.reduce((a,b)=>a+b,0)/innerScores.length;
  }

  const colorScore = mainPair.score*outerWeight + innerColorScore*innerWeight;

  // 多層加成
  const layerBonus = layers.length > 1 ? 0.5 : 0;

  // 用戶個人權重（v1.5 回饋機制）
  const userRuleWeight = userPrefs[mainPair.rule] || 0;
  const finalColorScore = Math.min(10, colorScore + layerBonus + userRuleWeight);

  // ── 材質評分 ──
  const matResult = scoreMaterial(layers, bottom, occasion);

  // ── 廓形評分 ──
  const silResult = scoreSilhouette(layers, bottom, bodyType, occasion);

  // ── 市場現實評分（v3.3）──
  const marketResult       = scoreMarketReality(bottom, layers);
  const adjustedColorScore = Math.min(10, Math.max(0, finalColorScore + marketResult.adjustment));

  // ── 下身顏色場合評分（v3.4）──
  const user = { colorSeason: userPrefs._colorSeason || 'true_winter' };
  const bottomColorResult = scoreBottomColor(bottom, occasion, user.colorSeason);
  const topHarmonyResult  = scoreTopBottomHarmony(bottom, outerTop);

  const bottomColorAdj =
    (bottomColorResult.occasionScore - 1.0) * 0.3 +
     bottomColorResult.seasonBonus * 0.2 +
     bottomColorResult.blackPenalty +
     topHarmonyResult.bonus * 0.2;

  // ── 最終五維加權（v3.4）──
  const finalScore =
    (adjustedColorScore / 10) * 0.40 +
    (matResult.materialScore / 10) * 0.22 +
    (silResult.silhouetteScore / 10) * 0.18 +
    Math.max(0, marketResult.adjustment) * 0.10 +
    Math.max(-0.5, Math.min(0.3, bottomColorAdj)) * 0.10;

  return {
    score:              Math.round(finalScore * 100) / 100,
    colorScore:         Math.round(adjustedColorScore * 10) / 10,
    matScore:           matResult.materialScore,
    silScore:           silResult.silhouetteScore,
    colorRule:          mainPair.rule,
    colorReason:        mainPair.reason,
    materialLaws:       matResult.laws,
    materialTips:       matResult.tips,
    silPrinciple:       silResult.principle,
    silNote:            silResult.note,
    marketBonuses:      marketResult.bonuses,
    marketPenalties:    marketResult.penalties,
    bottomColorTips:    bottomColorResult.tips,
    topHarmonyWarning:  topHarmonyResult.warning,
    warnings:           [...(matResult.warnings||[]), ...(silResult.warnings||[]), ...marketResult.penalties],
    topColor,
    bottomColor,
  };
}

// ════════════════════════════════════════════════
// 配件建議（夾心規則 + 呼應法則 + 2026 趨勢）
// ════════════════════════════════════════════════

const TREND_2026 = [
  { hex:'#008080', label:'Transformative Teal' },
  { hex:'#FF007F', label:'Electric Fuchsia'    },
  { hex:'#C4956A', label:'Mocha Mousse'         },
];

function suggestAccessories(layers, bottom, occasion) {
  const topColor    = getMainColor(layers[layers.length-1]);
  const bottomColor = getMainColor(bottom);

  // 夾心規則：帽色 = 鞋色 = 下身主色
  const sandwichColor = bottomColor;

  let shoeColor;
  const formalOccasions = ['formal','work_interview','work_presentation'];
  if (formalOccasions.includes(occasion)) {
    shoeColor = isAchromatic(bottomColor) ? bottomColor : '#000000';
  } else {
    // 趨勢色中找與主色評分 ≥7 的
    const trendMatch = TREND_2026.find(t => calcColorScore(topColor, t.hex).score >= 7);
    shoeColor = trendMatch?.hex || sandwichColor;
  }

  return {
    hat:   { hex: sandwichColor, label: '呼應下身色（夾心規則）' },
    shoes: { hex: shoeColor,     label: isAchromatic(shoeColor) ? '中性穩重' : '趨勢色點綴' },
    bag:   { hex: shoeColor,     label: '鞋包同色（呼應法則）' },
  };
}

// ════════════════════════════════════════════════
// 篩選衣物
// ════════════════════════════════════════════════

function filterWardrobe(wardrobe, { occasion, season }) {
  return wardrobe.filter(item => {
    const oMatch = !item.style_tags?.length  || item.style_tags.includes(occasion)  || item.style_tags.includes('all');
    const sMatch = !item.season_tags?.length || item.season_tags.includes(season)   || item.season_tags.includes('all');
    return oMatch && sMatch;
  });
}

// ════════════════════════════════════════════════
// 四級降級推薦機制（場合永遠不放寬）
// ════════════════════════════════════════════════

function generateWithFallback(wardrobe, params, outfitHistory) {
  const { occasion, season, skinTone, bodyType, topN, userPrefs } = params;

  // Lv0：正常篩選
  let filtered = filterWardrobe(wardrobe, { occasion, season });
  let result   = generateCombinations(filtered, params);
  if (result.length >= topN) return { level: 0, results: result.slice(0, topN) };

  // Lv1：放寬季節（忽略 season_tags，保留場合相容或無限制的衣物）
  const filteredOcc = wardrobe.filter(i =>
    !i.style_tags?.length || i.style_tags.includes(occasion) || i.style_tags.includes('all')
  );
  result = generateCombinations(filteredOcc, params);
  if (result.length >= topN) return { level: 1, results: result.slice(0, topN) };

  // Lv2：同 Lv1 篩選，放寬分數門檻（≥0.5 即可）
  result = generateCombinations(filteredOcc, { ...params, minScore: 0.5 });
  if (result.length >= topN) return { level: 2, results: result.slice(0, topN) };

  // Lv3：回傳用戶歷史記錄中場合符合的前 topN 套
  if (outfitHistory && outfitHistory.length > 0) {
    const historyResults = outfitHistory
      .filter(h => h.occasion === occasion)
      .sort((a,b) => (b.user_score||0)-(a.user_score||0))
      .slice(0, topN)
      .map(h => ({ ...h, isHistorical: true }));
    if (historyResults.length > 0) return { level: 3, results: historyResults };
  }

  // Lv4：冷啟動（由 API 層回傳 /meta/demo-wardrobe）
  return { level: 4, results: [] };
}

function generateCombinations(filtered, params) {
  const { occasion, season, bodyType, userPrefs = {}, minScore = 0.65 } = params;

  const tops    = filtered.filter(i => ['inner_top','top','outer'].includes(i.category));
  const bottoms = filtered.filter(i => i.category === 'bottom');
  if (tops.length===0 || bottoms.length===0) return [];

  const layerCombos = buildLayerCombos(tops);
  const scored = [];

  for (const layers of layerCombos) {
    for (const bottom of bottoms) {
      const result = scoreOutfit(layers, bottom, occasion, season, bodyType, userPrefs);
      if (result.score >= minScore) {
        scored.push({ layers, bottom, ...result,
          accessories: suggestAccessories(layers, bottom, occasion) });
      }
    }
  }

  // 去重 + 排序
  scored.sort((a,b) => b.score-a.score);
  const seen = new Set();
  return scored.filter(o => {
    const key = `${o.bottom.id}_${o.layers[o.layers.length-1].id}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

// ════════════════════════════════════════════════
// 主函式：生成推薦
// ════════════════════════════════════════════════

/**
 * @param {object} params
 * @param {Array}  params.wardrobe       - 用戶所有衣物
 * @param {string} params.occasion       - 場合 key
 * @param {string} params.season         - spring|summer|autumn|winter
 * @param {string} params.colorSeason    - 12色季之一（冷啟動用）
 * @param {string} params.skinTone       - cool_white|warm_yellow|wheat_tan|neutral
 * @param {string} params.bodyType       - upper_heavy|pear_shape|balanced
 * @param {object} params.userPrefs      - { rule_name: weight_delta } 用戶個人權重
 * @param {number} params.topN           - 回傳幾套（預設3）
 * @param {Array}  params.outfitHistory  - 穿搭歷史（降級 Lv3 用）
 */
function generateRecommendations({
  wardrobe, occasion, season,
  colorSeason, skinTone, bodyType,
  userPrefs = {}, topN = 3,
  outfitHistory = []
}) {
  const params = { occasion, season, skinTone, bodyType, userPrefs, topN };
  const { level, results } = generateWithFallback(wardrobe, params, outfitHistory);

  if (level === 4) {
    if (colorSeason) {
      const guidance = generateColdStartRecommendations({ colorSeason, skinTone, bodyType, occasion, season });
      if (guidance) return { ...guidance, fallback_level: 4 };
    }
    return { error: 'COLD_START', message: '衣橱為空，請查看範例穿搭', fallback_endpoint: '/meta/demo-wardrobe' };
  }

  return {
    occasion, season,
    fallback_level:   level,  // 0=正常, 1-4=降級
    recommendations: results.map((o, i) => ({
      rank:   i + 1,
      score:  o.score,
      layers: o.layers?.map(l => ({
        id:         l.id,
        name:       l.name,
        category:   l.category,
        layer_order:l.layer_order,
        mainColor:  getMainColor(l),
        material:   l.material_key,
        silhouette: l.silhouette,
      })),
      bottom: {
        id:         o.bottom?.id,
        name:       o.bottom?.name,
        mainColor:  o.bottomColor,
        material:   o.bottom?.material_key,
        silhouette: o.bottom?.silhouette,
      },
      accessories: o.accessories,
      analysis: {
        color:     { score: o.colorScore, rule: o.colorRule, reason: o.colorReason },
        material:  { score: o.matScore,   laws: o.materialLaws, tips: o.materialTips },
        silhouette:{ score: o.silScore,   principle: o.silPrinciple, note: o.silNote },
        market:    { bonuses: o.marketBonuses || [], penalties: o.marketPenalties || [] },
        warnings:  o.warnings,
        trend_tip: `2026 年流行色：${TREND_2026[0].label}（${TREND_2026[0].hex}）可作為配件點綴`,
      },
    }))
  };
}

// ════════════════════════════════════════════════
// 冷啟動色彩引導（衣橱為空但已設定色季）
// ════════════════════════════════════════════════

const COLD_START_PALETTES = {
  bright_spring: {
    label: '明亮春型', undertone: 'warm',
    base:   [{ hex: '#FFFFFF', label: '純白' },       { hex: '#FAF0E6', label: '亞麻白' }],
    core:   [{ hex: '#FF6B35', label: '活力珊瑚橘' }, { hex: '#40B3A2', label: '清澈藍綠' }, { hex: '#FFD166', label: '鮮亮黃' }],
    accent: { hex: '#FF69B4', label: '熱帶粉' },
  },
  true_spring: {
    label: '純正春型', undertone: 'warm',
    base:   [{ hex: '#FAF0E6', label: '溫暖亞麻白' }, { hex: '#FFFFF0', label: '象牙白' }],
    core:   [{ hex: '#FF7F50', label: '珊瑚橘' },     { hex: '#20B2AA', label: '清澈青綠' }, { hex: '#F4C430', label: '向日葵黃' }],
    accent: { hex: '#FF6347', label: '番茄紅' },
  },
  light_spring: {
    label: '淡柔春型', undertone: 'warm',
    base:   [{ hex: '#FFFFF0', label: '象牙白' },     { hex: '#FFF5EE', label: '貝殼白' }],
    core:   [{ hex: '#FFDAB9', label: '桃子粉' },     { hex: '#98FB98', label: '薄荷綠' },   { hex: '#FFD1DC', label: '奶油粉' }],
    accent: { hex: '#FFA07A', label: '淡鮭魚粉' },
  },
  light_summer: {
    label: '淡柔夏型', undertone: 'cool',
    base:   [{ hex: '#F0F4FF', label: '冷調白' },     { hex: '#F8F8FF', label: '幽靈白' }],
    core:   [{ hex: '#B0C4DE', label: '霧藍' },       { hex: '#E6E6FA', label: '薰衣草紫' }, { hex: '#C8A2C8', label: '丁香紫' }],
    accent: { hex: '#FFB6C1', label: '淡玫瑰粉' },
  },
  true_summer: {
    label: '純正夏型', undertone: 'cool',
    base:   [{ hex: '#F5F0F2', label: '冷調米白' },   { hex: '#EDE8F0', label: '灰粉白' }],
    core:   [{ hex: '#7B9EB8', label: '霧鋼藍' },     { hex: '#B096B5', label: '玫瑰灰' },   { hex: '#8FA8A8', label: '霧青' }],
    accent: { hex: '#C3A3B5', label: '玫瑰霧' },
  },
  soft_summer: {
    label: '柔和夏型', undertone: 'cool',
    base:   [{ hex: '#EDE8EB', label: '灰調奶白' },   { hex: '#E8E3E8', label: '灰紫白' }],
    core:   [{ hex: '#6699CC', label: '灰調藍' },     { hex: '#9B8EA8', label: '霧紫' },     { hex: '#A09688', label: '暖灰' }],
    accent: { hex: '#D4A5A5', label: '灰調玫瑰' },
  },
  soft_autumn: {
    label: '柔和秋型', undertone: 'warm',
    base:   [{ hex: '#F5EDE0', label: '暖米色' },     { hex: '#FFF8F0', label: '奶油米' }],
    core:   [{ hex: '#CC7722', label: '橘棕' },       { hex: '#7A8C5C', label: '橄欖綠' },   { hex: '#C4956A', label: '駝色' }],
    accent: { hex: '#E07B39', label: '暖橙棕' },
  },
  true_autumn: {
    label: '純正秋型', undertone: 'warm',
    base:   [{ hex: '#FFF8DC', label: '奶油黃' },     { hex: '#FDF5E6', label: '舊蕾絲' }],
    core:   [{ hex: '#B7410E', label: '鐵鏽橘' },     { hex: '#556B2F', label: '深橄欖' },   { hex: '#D2691E', label: '巧克力棕' }],
    accent: { hex: '#E2A64B', label: '琥珀金' },
  },
  deep_autumn: {
    label: '深邃秋型', undertone: 'warm',
    base:   [{ hex: '#F5DEB3', label: '小麥色' },     { hex: '#DEB887', label: '棕褐米' }],
    core:   [{ hex: '#722F37', label: '波爾多酒紅' }, { hex: '#4A4A23', label: '深橄欖' },   { hex: '#8B4513', label: '馬鞍棕' }],
    accent: { hex: '#9B1B30', label: '深寶石紅' },
  },
  deep_winter: {
    label: '深邃冬型', undertone: 'cool',
    base:   [{ hex: '#1C1C2E', label: '近黑深藍' },   { hex: '#000000', label: '純黑' }],
    core:   [{ hex: '#00008B', label: '深海藍' },     { hex: '#800020', label: '深酒紅' },   { hex: '#36454F', label: '礦石灰' }],
    accent: { hex: '#4169E1', label: '皇家藍' },
  },
  true_winter: {
    label: '純正冬型', undertone: 'cool',
    base:   [{ hex: '#FFFFFF', label: '純白' },       { hex: '#000000', label: '純黑' }],
    core:   [{ hex: '#000080', label: '海軍藍' },     { hex: '#DC143C', label: '緋紅' },     { hex: '#008B8B', label: '暗青藍' }],
    accent: { hex: '#CC0022', label: '寶石紅' },
  },
  bright_winter: {
    label: '明亮冬型', undertone: 'cool',
    base:   [{ hex: '#FFFFFF', label: '純白' },       { hex: '#000000', label: '純黑' }],
    core:   [{ hex: '#0047AB', label: '鈷藍' },       { hex: '#CC0066', label: '覆盆子紅' }, { hex: '#008080', label: '藍綠' }],
    accent: { hex: '#00B4D8', label: '電光藍' },
  },
};

const SILHOUETTE_BY_BODY = {
  upper_heavy: {
    top:    'slim 或 wrap（修身上衣或收腰設計）',
    bottom: 'wide_leg 或 straight（闊腿/直筒褲平衡上半身）',
    tip:    '下身選分量感款式以平衡上下比例，避免寬鬆上衣',
  },
  pear_shape: {
    top:    'oversized 或 off_shoulder（寬鬆上衣轉移視線）',
    bottom: 'a_line 或 maxi（A字裙/長裙自然修飾臀部）',
    tip:    '上衣可選亮色或花紋，下身選素色深色',
  },
  balanced: {
    top:    '任何輪廓均適合',
    bottom: '任何輪廓均適合',
    tip:    '比例平衡，可依喜好自由搭配任何廓形',
  },
};

const OCCASION_LABELS = {
  work_interview:    '面試',
  work_presentation: '簡報',
  work_creative:     '創意辦公',
  work_daily:        '日常上班',
  date_first:        '初次約會',
  date_casual:       '輕鬆約會',
  casual:            '日常休閒',
  outdoor:           '戶外活動',
  party:             '派對',
  sport:             '運動',
};

/**
 * 冷啟動推薦：根據色彩季 × 場合 × 季節，產出購色指南
 * @param {object} params
 * @param {string} params.colorSeason - 12色季之一
 * @param {string} params.skinTone    - 膚色
 * @param {string} params.bodyType    - 體型
 * @param {string} params.occasion    - 場合
 * @param {string} params.season      - 春夏秋冬
 * @returns {object} COLOR_GUIDANCE 結果
 */
function generateColdStartRecommendations({ colorSeason, skinTone, bodyType, occasion, season }) {
  const profile = COLD_START_PALETTES[colorSeason];
  if (!profile) return null;

  const { base, core, accent } = profile;
  const isFormal   = ['work_interview', 'work_presentation'].includes(occasion);
  const isRomantic = ['date_first', 'party'].includes(occasion);
  const isCasual   = ['casual', 'outdoor', 'sport'].includes(occasion);
  const isWarmSeason = ['spring', 'summer'].includes(season);

  // Pick 4 outfit slots from the palette
  let outerwear, top, bottom, accentSlot;

  if (isFormal) {
    outerwear  = { color: core[0].hex,  label: `${core[0].label}外套` };
    top        = { color: base[0].hex,  label: `${base[0].label}上衣` };
    bottom     = { color: base[1].hex,  label: `${base[1].label}長褲（中性色）` };
    accentSlot = { color: accent.hex,   label: `${accent.label}配件` };
  } else if (isRomantic) {
    outerwear  = { color: core[1].hex,  label: `${core[1].label}外套/上衣` };
    top        = { color: core[0].hex,  label: `${core[0].label}上衣` };
    bottom     = { color: base[0].hex,  label: `${base[0].label}裙褲（中性色）` };
    accentSlot = { color: accent.hex,   label: `${accent.label}配件` };
  } else if (isCasual) {
    outerwear  = { color: core[1].hex,  label: `${core[1].label}外套` };
    top        = { color: core[0].hex,  label: `${core[0].label}T恤/上衣` };
    bottom     = { color: base[1].hex,  label: `${base[1].label}褲子（中性色）` };
    accentSlot = { color: accent.hex,   label: `${accent.label}配件` };
  } else {
    // work_creative / date_casual / work_daily
    outerwear  = { color: core[0].hex,  label: `${core[0].label}外套` };
    top        = { color: core[1].hex,  label: `${core[1].label}上衣` };
    bottom     = { color: base[1].hex,  label: `${base[1].label}長褲/裙（中性色）` };
    accentSlot = { color: accent.hex,   label: `${accent.label}配件` };
  }

  // In spring/summer outerwear is lighter / optional
  if (isWarmSeason) {
    outerwear.label = outerwear.label.replace('外套', '薄外套/罩衫');
  }

  const bodyTips = SILHOUETTE_BY_BODY[bodyType] || SILHOUETTE_BY_BODY.balanced;
  const occasionLabel = OCCASION_LABELS[occasion] || occasion;
  const seasonLabel   = { spring:'春', summer:'夏', autumn:'秋', winter:'冬' }[season] || season;

  return {
    coldStartType:   'COLOR_GUIDANCE',
    colorSeason,
    colorSeasonLabel: profile.label,
    occasion,
    season,
    suggestedOutfitStructure: { outerwear, top, bottom, accent: accentSlot },
    silhouetteSuggestion:     bodyTips,
    reasoning: `根據你的${profile.label}色季特性，搭配「${occasionLabel}」場合與${seasonLabel}季，以下四個顏色是最能展現你魅力的基礎款。`,
    shoppingGuide: `先買這四個顏色的基礎款，上傳到衣橱後即可獲得完整的三維評分穿搭推薦。`,
  };
}

module.exports = {
  generateRecommendations,
  generateColdStartRecommendations,
  calcColorScore,
  hexToHsl,
  hueDiff,
  suggestAccessories,
};
