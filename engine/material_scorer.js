/**
 * WARDROBE AI — 材質評分模組
 * 基於三份色彩×材質研究報告的規則庫
 * 零 AI API 費用，純查表計算
 *
 * 整合進 engine/recommender.js 的 scoreOutfit 函式
 */

// ─────────────────────────────────────────
// 材質光學特性靜態規則（同步自 material_types 資料表）
// ─────────────────────────────────────────
const MATERIAL_RULES = {
  silk_satin:    { gloss:'high',   brightMod:+1.5, satMod:-0.8, touch:'smooth_cool',  bestSat:'medium' },
  silk_crepe:    { gloss:'low',    brightMod:+0.5, satMod:-0.3, touch:'smooth_cool',  bestSat:'medium' },
  silk_georgette:{ gloss:'none',   brightMod:-0.5, satMod:-0.5, touch:'smooth_cool',  bestSat:'low'    },
  wool_fine:     { gloss:'low',    brightMod:-0.5, satMod:+0.8, touch:'soft_warm',    bestSat:'low'    },
  wool_coarse:   { gloss:'none',   brightMod:-1.0, satMod:+0.5, touch:'rough_natural',bestSat:'low'    },
  cashmere:      { gloss:'none',   brightMod:-0.5, satMod:+0.6, touch:'soft_warm',    bestSat:'low'    },
  cotton:        { gloss:'none',   brightMod:-0.3, satMod:+0.2, touch:'soft_warm',    bestSat:'high'   },
  linen:         { gloss:'none',   brightMod:-0.8, satMod:-0.2, touch:'rough_natural',bestSat:'low'    },
  cotton_linen:  { gloss:'none',   brightMod:-0.5, satMod:+0.1, touch:'rough_natural',bestSat:'low'    },
  leather_matte: { gloss:'low',    brightMod:+0.3, satMod:+0.3, touch:'stiff_formal', bestSat:'medium' },
  leather_patent:{ gloss:'high',   brightMod:+2.0, satMod:-1.0, touch:'stiff_formal', bestSat:'low'    },
  knit_chunky:   { gloss:'none',   brightMod:-1.2, satMod:-0.3, touch:'soft_warm',    bestSat:'low'    },
  knit_fine:     { gloss:'low',    brightMod:-0.3, satMod:+0.3, touch:'soft_warm',    bestSat:'medium' },
  acetate:       { gloss:'medium', brightMod:+0.8, satMod:-0.2, touch:'smooth_cool',  bestSat:'high'   },
  polyester:     { gloss:'medium', brightMod: 0.0, satMod: 0.0, touch:'stiff_formal', bestSat:'medium' },
  nylon:         { gloss:'medium', brightMod:+0.5, satMod:-0.3, touch:'smooth_cool',  bestSat:'medium' },
  velvet:        { gloss:'medium', brightMod:-0.5, satMod:+1.0, touch:'soft_warm',    bestSat:'low'    },
  denim:         { gloss:'none',   brightMod:-0.5, satMod:+0.3, touch:'stiff_formal', bestSat:'medium' },
  chiffon:       { gloss:'none',   brightMod:-0.3, satMod:-0.4, touch:'smooth_cool',  bestSat:'low'    },
  organza:       { gloss:'high',   brightMod:+0.8, satMod:-0.5, touch:'stiff_formal', bestSat:'low'    },
};

// 色相對材質敏感度（高敏感色系在選材時需更謹慎）
const HUE_SENSITIVITY = {
  blue:   'high',
  grey:   'low',
  yellow: 'low',
  red:    'medium',
  green:  'medium',
  white:  'high',
  black:  'medium',
};

// ─────────────────────────────────────────
// 材質光澤等級數值化
// ─────────────────────────────────────────
const GLOSS_LEVEL = { high: 3, medium: 2, low: 1, none: 0 };

function getMaterialRule(materialKey) {
  return MATERIAL_RULES[materialKey] || { gloss:'none', brightMod:0, satMod:0, touch:'soft_warm', bestSat:'medium' };
}

// ─────────────────────────────────────────
// 四大材質×色彩交互法則評分
// ─────────────────────────────────────────

/**
 * 計算兩件衣物的材質交互加分
 * @param {object} item1 - { material_key, colors, hsl_h, hsl_s, hsl_l }
 * @param {object} item2
 * @returns { bonus: number, law: string, tip: string }
 */
function scoreMaterialInteraction(item1, item2) {
  const m1 = getMaterialRule(item1.material_key || 'cotton');
  const m2 = getMaterialRule(item2.material_key || 'cotton');

  const gloss1 = GLOSS_LEVEL[m1.gloss];
  const gloss2 = GLOSS_LEVEL[m2.gloss];
  const glossDiff = Math.abs(gloss1 - gloss2);

  const h1 = item1.hsl_h || 0;
  const h2 = item2.hsl_h || 0;
  const rawDiff = Math.abs(h1 - h2);
  const hueDiff = rawDiff > 180 ? 360 - rawDiff : rawDiff;

  const sameMaterial = item1.material_key === item2.material_key;
  const sameColor    = hueDiff <= 15;

  // 同色異質法：同色 + 不同材質 → +0.5
  if (sameColor && !sameMaterial) {
    return {
      bonus: 0.5,
      law: '同色異質',
      tip: '同色深淺搭配不同材質，低調奢華有層次感'
    };
  }

  // 異色同質法：不同色 + 相同材質 → +0.3
  if (!sameColor && sameMaterial) {
    return {
      bonus: 0.3,
      law: '異色同質',
      tip: '相同材質統一撞色，材質提供和諧「安全網」'
    };
  }

  // 光澤對比法：光澤差距大（≥2級）→ +0.5
  if (glossDiff >= 2) {
    return {
      bonus: 0.5,
      law: '光澤對比',
      tip: `${m1.gloss === 'high' || m1.gloss === 'medium' ? '光澤面推出色彩' : '啞光面收住色彩'}，形成戲劇張力`
    };
  }

  // 肌理對比法：觸感類型不同 + 同色 → +0.3
  if (m1.touch !== m2.touch && sameColor) {
    return {
      bonus: 0.3,
      law: '肌理對比',
      tip: '平滑與粗糙並置，同色形成「同色異感」細膩效果'
    };
  }

  return { bonus: 0, law: null, tip: null };
}

// ─────────────────────────────────────────
// 材質與色彩相容性驗證
// 確認衣物的色彩飽和度是否與材質最佳飽和度相符
// ─────────────────────────────────────────

/**
 * 檢查衣物色彩是否適合其材質
 * @returns { compatible: boolean, penalty: number, warning: string|null }
 */
function checkMaterialColorCompatibility(item) {
  const mat = getMaterialRule(item.material_key || 'cotton');
  const sat = item.hsl_s || 50; // 0-100

  const satCategory = sat > 65 ? 'high' : sat > 35 ? 'medium' : 'low';

  if (mat.bestSat === 'low' && satCategory === 'high') {
    return {
      compatible: false,
      penalty: -1.0,
      warning: `${item.material_key || '此材質'}建議低飽和色彩，高飽和色可能顯廉價或不融合`
    };
  }

  if (mat.bestSat === 'high' && satCategory === 'low') {
    // 只是不是最佳，不是不相容
    return { compatible: true, penalty: -0.2, warning: null };
  }

  return { compatible: true, penalty: 0, warning: null };
}

// ─────────────────────────────────────────
// 材質修正 HSL 感知值
// 讓推薦引擎使用「視覺感知後的 HSL」而非物理 HSL
// ─────────────────────────────────────────

function getPerceivedHsl(item) {
  const mat = getMaterialRule(item.material_key || 'cotton');
  return {
    h: item.hsl_h || 0,
    s: Math.min(100, Math.max(0, (item.hsl_s || 50) + mat.satMod * 5)),
    l: Math.min(100, Math.max(0, (item.hsl_l || 50) + mat.brightMod * 3)),
  };
}

// ─────────────────────────────────────────
// 場合×材質相容性
// ─────────────────────────────────────────
const OCCASION_MATERIAL_FIT = {
  work_interview:   ['wool_fine','cotton','silk_crepe','acetate','leather_matte'],
  work_presentation:['wool_fine','organza','silk_crepe','leather_matte'],
  work_creative:    ['linen','cotton_linen','knit_fine','denim','cotton'],
  work_daily:       ['cotton','wool_fine','knit_fine','acetate','denim'],
  date_first:       ['silk_crepe','silk_satin','acetate','knit_fine','velvet'],
  date_casual:      ['cotton','knit_fine','chiffon','acetate'],
  casual:           ['cotton','linen','denim','knit_chunky','cotton_linen'],
  outdoor:          ['cotton','linen','cotton_linen','denim'],
  party:            ['silk_satin','velvet','acetate','leather_patent','chiffon'],
  sport:            ['polyester','nylon','cotton'],
};

/**
 * 計算衣物材質與場合的相容性加分
 */
function scoreMaterialOccasion(item, occasion) {
  const goodMaterials = OCCASION_MATERIAL_FIT[occasion] || [];
  const mat = item.material_key || 'cotton';
  if (goodMaterials.includes(mat)) return { bonus: 0.3, note: '材質適合此場合' };
  return { bonus: 0, note: null };
}

// ─────────────────────────────────────────
// 主函式：材質綜合評分
// 整合進 recommender.js 的 scoreOutfit
// ─────────────────────────────────────────

/**
 * 計算整套穿搭的材質相關分數
 * @param {Array}  layers   - 上衣陣列（含 material_key, hsl_h/s/l）
 * @param {object} bottom   - 下身（含 material_key, hsl_h/s/l）
 * @param {string} occasion - 場合 key
 * @returns { materialScore: number, laws: string[], tips: string[], warnings: string[] }
 */
function scoreMaterial(layers, bottom, occasion) {
  let score = 0;
  const laws = [];
  const tips = [];
  const warnings = [];

  const outerTop = layers[layers.length - 1];

  // 1. 外層上衣 × 下身 材質交互
  const interaction = scoreMaterialInteraction(outerTop, bottom);
  if (interaction.bonus > 0) {
    score += interaction.bonus;
    laws.push(interaction.law);
    if (interaction.tip) tips.push(interaction.tip);
  }

  // 2. 多層上衣間的材質交互（只評相鄰層）
  for (let i = 0; i < layers.length - 1; i++) {
    const inner = scoreMaterialInteraction(layers[i], layers[i + 1]);
    if (inner.bonus > 0) {
      score += inner.bonus * 0.5; // 內層交互加分打折
      if (inner.law && !laws.includes(inner.law)) laws.push(inner.law);
    }
  }

  // 3. 材質×色彩相容性（外層上衣 + 下身）
  [outerTop, bottom].forEach(item => {
    const compat = checkMaterialColorCompatibility(item);
    score += compat.penalty;
    if (compat.warning) warnings.push(compat.warning);
  });

  // 4. 場合相容性
  const occTop    = scoreMaterialOccasion(outerTop, occasion);
  const occBottom = scoreMaterialOccasion(bottom, occasion);
  score += occTop.bonus + occBottom.bonus;

  return {
    materialScore: Math.round(score * 10) / 10,
    laws,
    tips,
    warnings,
  };
}

module.exports = {
  scoreMaterial,
  scoreMaterialInteraction,
  checkMaterialColorCompatibility,
  getPerceivedHsl,
  scoreMaterialOccasion,
  getMaterialRule,
  MATERIAL_RULES,
};
