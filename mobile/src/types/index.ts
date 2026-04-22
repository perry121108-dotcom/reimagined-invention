export type Category = 'inner_top' | 'top' | 'outer' | 'bottom' | 'accessory';
export type LayerOrder = 1 | 2 | 3;
export type FitType = 'oversized' | 'slim' | 'regular' | 'cropped';
export type SilhouetteTop = 'oversized' | 'regular' | 'slim' | 'cropped' | 'peplum' | 'wrap' | 'off_shoulder';
export type SilhouetteBottom = 'wide_leg' | 'straight' | 'slim_fit' | 'a_line' | 'pencil' | 'mini' | 'maxi';
export type Silhouette = SilhouetteTop | SilhouetteBottom;
export type MaterialKey =
  | 'silk_satin' | 'silk_crepe' | 'silk_georgette'
  | 'wool_fine' | 'wool_coarse' | 'cashmere'
  | 'cotton' | 'linen' | 'cotton_linen'
  | 'leather_matte' | 'leather_patent'
  | 'knit_chunky' | 'knit_fine'
  | 'acetate' | 'polyester' | 'nylon'
  | 'velvet' | 'denim' | 'chiffon' | 'organza';
export type PatternType = 'solid' | 'stripe' | 'check' | 'dot' | 'floral' | 'geometric' | 'abstract' | 'print_multi';
export type DrapeLevel = 'high' | 'medium' | 'low' | 'none';
export type SkinTone = 'cool_white' | 'warm_yellow' | 'wheat_tan' | 'neutral';
export type BodyType = 'upper_heavy' | 'pear_shape' | 'balanced';
export type Occasion =
  | 'work_interview' | 'work_presentation' | 'work_creative' | 'work_daily'
  | 'date_first' | 'date_casual' | 'casual' | 'outdoor' | 'party' | 'sport';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type ColorSeason =
  | 'bright_spring' | 'true_spring' | 'light_spring'
  | 'light_summer' | 'true_summer' | 'soft_summer'
  | 'soft_autumn' | 'true_autumn' | 'deep_autumn'
  | 'deep_winter' | 'true_winter' | 'bright_winter';

export type ColorEntry = { hex: string; ratio: number };

export type ClothingItem = {
  id: number;
  name?: string;
  category: Category;
  layer_order: LayerOrder;
  fit_type: FitType;
  silhouette: Silhouette;
  material_key: MaterialKey;
  pattern_type: PatternType;
  drape_level: DrapeLevel;
  colors: ColorEntry[];
  is_pattern: boolean;
  image_url?: string;
  season: Season[];
  occasion: Occasion[];
};

// ── Recommend API ──────────────────────────────────────────────────
export type AccessoryDetail = { hex: string; label: string };

export type RecommendAnalysis = {
  color:     { score: number; rule: string; reason: string };
  material:  { score: number; laws: string[]; tips: string[] };
  silhouette:{ score: number; principle: string; note: string };
  warnings:  string[];
  trend_tip: string;
};

export type RecommendedLayer = {
  id: number;
  name?: string;
  category: Category;
  layer_order?: number;
  mainColor: string;
  material: MaterialKey;
  silhouette: Silhouette;
};

export type RecommendedBottom = {
  id: number;
  name?: string;
  mainColor: string;
  material: MaterialKey;
  silhouette: Silhouette;
};

export type RecommendedOutfit = {
  rank: number;
  score: number;
  layers: RecommendedLayer[];
  bottom: RecommendedBottom;
  accessories: { hat: AccessoryDetail; shoes: AccessoryDetail; bag: AccessoryDetail };
  analysis: RecommendAnalysis;
};

export type RecommendResponse = {
  occasion: string;
  season: string;
  fallback_level: number;
  recommendations: RecommendedOutfit[];
};

export type ColdStartSimple = {
  error: 'COLD_START';
  message: string;
  fallback_endpoint: string;
};

export type ColdStartColorGuide = {
  coldStartType: 'COLOR_GUIDANCE';
  colorSeason: ColorSeason;
  colorSeasonLabel: string;
  occasion: Occasion;
  season: Season;
  suggestedOutfitStructure: {
    outerwear: { color: string; label: string };
    top:       { color: string; label: string };
    bottom:    { color: string; label: string };
    accent:    { color: string; label: string };
  };
  silhouetteSuggestion: {
    top:    string;
    bottom: string;
    tip:    string;
  };
  reasoning:     string;
  shoppingGuide: string;
};

export type ColdStartResponse = ColdStartSimple | ColdStartColorGuide;

export type OccasionMeta = {
  occasion_key: string;
  occasion_name: string;
  goal: string;
};

// ── User ───────────────────────────────────────────────────────────
export type User = {
  id: number;
  email: string;
  skin_tone: SkinTone;
  body_type: BodyType;
  color_season: ColorSeason;
};
