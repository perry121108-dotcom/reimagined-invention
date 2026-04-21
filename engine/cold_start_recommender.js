/**
 * WARDROBE AI — engine/recommender.js 新增函式
 * 冷啟動色彩推薦 (Cold Start Color Guidance)
 * 當衣物不足時，根據用戶設定推薦購買顏色
 */

// ════════════════════════════════════════════════
// 色季對應的色彩特性與建議
// ════════════════════════════════════════════════
const COLOR_SEASON_PALETTE = {
  bright_spring: {
    undertone: 'warm', clarity: 'bright',
    primaryColor: '#FF69B4', accentColor: '#FFD700', neutralColor: '#FFFFFF',
    label: '淨春型', characteristics: '明亮活潑、溫暖、高對比'
  },
  true_spring: {
    undertone: 'warm', clarity: 'bright',
    primaryColor: '#FF7F50', accentColor: '#FFD700', neutralColor: '#F5F5DC',
    label: '暖春型', characteristics: '溫暖清澈、金色系'
  },
  light_spring: {
    undertone: 'warm', clarity: 'light',
    primaryColor: '#FFCBA4', accentColor: '#98FF98', neutralColor: '#ADD8E6',
    label: '淺春型', characteristics: '糖果粉彩、輕盈'
  },
  light_summer: {
    undertone: 'cool', clarity: 'light',
    primaryColor: '#ADD8E6', accentColor: '#FFB6C1', neutralColor: '#FFFFFF',
    label: '淺夏型', characteristics: '輕透冷調粉彩'
  },
  true_summer: {
    undertone: 'cool', clarity: 'muted',
    primaryColor: '#6F8FAF', accentColor: '#C21E56', neutralColor: '#D3D3D3',
    label: '冷夏型', characteristics: '冷灰中等飽和'
  },
  soft_summer: {
    undertone: 'cool', clarity: 'soft',
    primaryColor: '#B2AC88', accentColor: '#6699CC', neutralColor: '#D4A5A5',
    label: '柔夏型', characteristics: '灰調霧面低對比'
  },
  soft_autumn: {
    undertone: 'warm', clarity: 'soft',
    primaryColor: '#C2B280', accentColor: '#9E7B4F', neutralColor: '#B7410E',
    label: '柔秋型', characteristics: '灰調大地色'
  },
  true_autumn: {
    undertone: 'warm', clarity: 'muted',
    primaryColor: '#FFDB58', accentColor: '#FF7518', neutralColor: '#6F4E37',
    label: '暖秋型', characteristics: '豐富秋色、金飾首選'
  },
  deep_autumn: {
    undertone: 'warm', clarity: 'deep',
    primaryColor: '#8B2500', accentColor: '#008080', neutralColor: '#3B1C08',
    label: '深秋型', characteristics: '深沉飽和暖調'
  },
  deep_winter: {
    undertone: 'cool', clarity: 'deep',
    primaryColor: '#00008B', accentColor: '#4B0082', neutralColor: '#000000',
    label: '深冬型', characteristics: '極深冷色'
  },
  true_winter: {
    undertone: 'cool', clarity: 'bright',
    primaryColor: '#DC143C', accentColor: '#0047AB', neutralColor: '#000000',
    label: '冷冬型', characteristics: '純淨冷色高對比'
  },
  bright_winter: {
    undertone: 'cool', clarity: 'bright',
    primaryColor: '#BF00FF', accentColor: '#00FFFF', neutralColor: '#FFFFFF',
    label: '淨冬型', characteristics: '明亮閃耀強對比'
  },
};

// 場合對應的基礎色彩策略
const OCCASION_COLOR_GUIDE = {
  work_interview: {
    primaryColor: '#1F3A5F', accentColor: '#FFFFFF',
    description: '專業沉穩'
  },
  work_presentation: {
    primaryColor: '#36454F', accentColor: '#800020',
    description: '權威成熟'
  },
  work_creative: {
    primaryColor: '#C0C0C0', accentColor: '#4169E1',
    description: '開放創新'
  },
  work_daily: {
    primaryColor: '#36454F', accentColor: '#FFFFFF',
    description: '沉穩耐看'
  },
  date_first: {
    primaryColor: '#FF0000', accentColor: '#FFC0CB',
    description: '吸引溫柔'
  },
  date_casual: {
    primaryColor: '#FFC0CB', accentColor: '#E6E6FA',
    description: '溫柔親近'
  },
  casual: {
    primaryColor: '#C2B280', accentColor: '#6B8E23',
    description: '舒適自然'
  },
  outdoor: {
    primaryColor: '#F0E68C', accentColor: '#228B22',
    description: '自然大地感'
  },
  party: {
    primaryColor: '#000000', accentColor: '#FFD700',
    description: '華麗存在感'
  },
  sport: {
    primaryColor: '#000080', accentColor: '#FF6347',
    description: '活力俐落'
  },
};

// 體型對應的廓形建議
const BODY_SILHOUETTE_GUIDE = {
  upper_heavy: {
    topRecommendation: 'slim 或 wrap（修身或收腰）',
    bottomRecommendation: 'wide_leg（闊腿平衡上身）',
    tip: '避免上半身膨脹，用下身寬鬆平衡視覺'
  },
  pear_shape: {
    topRecommendation: 'oversized 或 peplum（寬鬆或有細節）',
    bottomRecommendation: 'a_line 或 wide_leg（自然遮蓋）',
    tip: '上身寬鬆轉移視覺焦點到上方'
  },
  balanced: {
    topRecommendation: '任意廓形皆適合',
    bottomRecommendation: '任意廓形皆適合',
    tip: '体型均衡，廓形選擇自由'
  },
};

// 季節對應的色彩明度調整
const SEASON_BRIGHTNESS_ADJUST = {
  spring: { brightnessMod: 0, saturationMod: 0 },    // 春：原色
  summer: { brightnessMod: -5, saturationMod: -10 }, // 夏：降飽和降亮
  autumn: { brightnessMod: -10, saturationMod: 0 },  // 秋：降亮度
  winter: { brightnessMod: 0, saturationMod: +10 },  // 冬：加飽和
};

// ════════════════════════════════════════════════
// 色季 + 場合 → 具體色彩組合（帶體型修飾）
// ════════════════════════════════════════════════

/**
 * 色相修正：根據色季的色溫調整場合色
 * @param {string} baseHex - 場合基礎色
 * @param {string} colorSeason - 色季 key
 * @returns {string} - 調整後的 hex
 */
function adjustColorToSeason(baseHex, colorSeason) {
  // 簡化版：直接查表（實際可用 Lab 色相微調）
  const seasonData = COLOR_SEASON_PALETTE[colorSeason];
  if (!seasonData) return baseHex;
  return baseHex; // 實際應用可擴展為 LAB 空間微調
}

/**
 * 主函式：冷啟動色彩推薦
 * @param {string} colorSeason - 用戶色季 key
 * @param {string} skinTone - 膚色（用於驗證色季匹配）
 * @param {string} bodyType - 體型（用於廓形建議）
 * @param {string} occasion - 場合 key
 * @param {string} season - 季節 (spring/summer/autumn/winter)
 * @returns {object} - 色彩推薦結果
 */
function generateColdStartRecommendations({
  colorSeason, skinTone, bodyType, occasion, season
}) {
  if (!colorSeason) {
    return {
      coldStartType: 'NO_SETTING',
      message: '請先完成色季快速測驗或手動設定，以獲得個人化推薦',
      actionUrl: '/profile/color-test'
    };
  }

  const seasonData = COLOR_SEASON_PALETTE[colorSeason];
  const occasionData = OCCASION_COLOR_GUIDE[occasion] || OCCASION_COLOR_GUIDE.casual;
  const silhouetteData = BODY_SILHOUETTE_GUIDE[bodyType] || BODY_SILHOUETTE_GUIDE.balanced;
  const seasonAdjust = SEASON_BRIGHTNESS_ADJUST[season] || SEASON_BRIGHTNESS_ADJUST.spring;

  const outerWearColor = occasionData.primaryColor;
  const topColor       = seasonData.neutralColor;
  const bottomColor    = seasonData.primaryColor;
  const accentColor    = seasonData.accentColor;

  return {
    coldStartType: 'COLOR_GUIDANCE',
    colorSeason,
    colorSeasonLabel: seasonData.label,
    occasion,
    season,
    suggestedOutfitStructure: {
      outerwear: {
        color: outerWearColor,
        label: '外套',
        description: '場合搭配色'
      },
      top: {
        color: topColor,
        label: '上衣/襯衫',
        description: `${seasonData.label}中性色`
      },
      bottom: {
        color: bottomColor,
        label: '褲子/裙子',
        description: `${seasonData.label}主色`
      },
      accent: {
        color: accentColor,
        label: '配件（包、鞋、飾品）',
        description: `${seasonData.label}點綴色`
      }
    },
    silhouetteSuggestion: {
      topShape: silhouetteData.topRecommendation,
      bottomShape: silhouetteData.bottomRecommendation,
      tip: silhouetteData.tip
    },
    reasoning: {
      colorSeason: `根據你的 ${seasonData.label} 色季，${seasonData.characteristics}`,
      occasion: `${occasion} 場合建議 ${occasionData.description}`,
      season: `${season} 季選色應 ${seasonAdjust.saturationMod > 0 ? '提升飽和度' : '降低飽和度'}`
    },
    shoppingGuide: `
1. 先買外套、上衣、褲子各一件（上方推薦的四個顏色）
2. 從配件（鞋、包、飾品）開始點綴，預算有限時優先配件
3. 同色系衣物可搭配，避免超過 3 種主色
4. 試穿時對著鏡子看臉色是否提亮
    `,
    nextSteps: {
      uploadClothing: '上傳第一件衣物後，系統會自動推薦搭配',
      takeQuiz: '如果對色季不確定，可重新做色季測驗',
      viewTrends: '查看 2026 流行色：Transformative Teal (#008080) 可作點綴'
    }
  };
}

// ════════════════════════════════════════════════
// 匯出
// ════════════════════════════════════════════════
module.exports = {
  generateColdStartRecommendations,
  COLOR_SEASON_PALETTE,
  OCCASION_COLOR_GUIDE,
  BODY_SILHOUETTE_GUIDE,
};
