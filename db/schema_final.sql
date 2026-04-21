-- ============================================================
-- WARDROBE AI — schema_final.sql  v3.2
-- 完整資料庫建表（含所有版本合併，從頭執行此檔即可）
-- 共 18 張資料表
-- ============================================================

-- ─────────────────────────────────────────
-- 1. 用戶表
-- ─────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  color_season  VARCHAR(30),
  -- 12色季固定值：bright_spring/true_spring/light_spring
  --              light_summer/true_summer/soft_summer
  --              soft_autumn/true_autumn/deep_autumn
  --              deep_winter/true_winter/bright_winter
  skin_tone     VARCHAR(20),
  -- cool_white / warm_yellow / wheat_tan / neutral
  body_type     VARCHAR(20) DEFAULT 'balanced',
  -- upper_heavy / pear_shape / balanced
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 2. 衣物表（所有欄位最終版）
-- ─────────────────────────────────────────
CREATE TABLE clothing_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  image_url     VARCHAR(500),
  name          VARCHAR(100),

  -- 分類
  category      VARCHAR(20) NOT NULL,
  -- inner_top / top / outer / bottom / accessory
  layer_order   SMALLINT,
  -- 1=內搭  2=上衣  3=外套  (bottom/accessory 為 NULL)

  -- 色彩
  colors        JSONB NOT NULL DEFAULT '[]',
  -- [{ "hex": "#FF7F50", "ratio": 0.6 }]  面積大到小排序
  hsl_h         SMALLINT,   -- 主色色相 0-360（DB索引）
  hsl_s         SMALLINT,   -- 主色飽和度 0-100
  hsl_l         SMALLINT,   -- 主色明度 0-100
  is_pattern    BOOLEAN DEFAULT false,
  -- true = 碎花/條紋（colors[0].ratio < 0.35）

  -- 版型
  fit_type      VARCHAR(20) DEFAULT 'regular',
  -- oversized / slim / regular / cropped
  silhouette    VARCHAR(20) DEFAULT 'regular',
  -- 上衣/外套：oversized / regular / slim / cropped / peplum / wrap / off_shoulder
  -- 下身：     wide_leg / straight / slim_fit / a_line / pencil / mini / maxi

  -- 材質
  material_key  VARCHAR(30) DEFAULT 'cotton',
  -- 20種固定值（見 material_types 表）
  pattern_type  VARCHAR(20) DEFAULT 'solid',
  -- solid / stripe / check / dot / floral / geometric / abstract / print_multi
  drape_level   VARCHAR(10) DEFAULT 'medium',
  -- high（垂墜飄逸）/ medium / low（挺硬）/ none

  -- 標籤
  style_tags    TEXT[] DEFAULT '{}',
  -- casual / work / formal / date / sport / outdoor
  season_tags   TEXT[] DEFAULT '{}',
  -- spring / summer / autumn / winter / all

  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_clothing_user     ON clothing_items(user_id);
CREATE INDEX idx_clothing_hsl_h    ON clothing_items(hsl_h);
CREATE INDEX idx_clothing_category ON clothing_items(category);
CREATE INDEX idx_clothing_material ON clothing_items(material_key);
CREATE INDEX idx_clothing_silhouette ON clothing_items(silhouette);

-- ─────────────────────────────────────────
-- 3. 穿搭紀錄表
-- ─────────────────────────────────────────
CREATE TABLE outfit_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  worn_date       DATE NOT NULL,
  occasion        VARCHAR(30),
  season          VARCHAR(10),
  layer_ids       UUID[],
  bottom_id       UUID,
  accessory_ids   UUID[],
  hat_color_hex   CHAR(7),
  shoes_color_hex CHAR(7),
  bag_color_hex   CHAR(7),
  user_score      SMALLINT,        -- 用戶自評 1-5
  is_ai_suggested BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_outfit_user_date ON outfit_records(user_id, worn_date);

-- ─────────────────────────────────────────
-- 4. 色彩配色法則表（6種）
-- ─────────────────────────────────────────
CREATE TABLE color_rules (
  id              SERIAL PRIMARY KEY,
  rule_name       VARCHAR(30) NOT NULL,
  hue_diff_min    SMALLINT,
  hue_diff_max    SMALLINT,
  harmony_score   SMALLINT NOT NULL,
  suitable_occasions TEXT[] NOT NULL,
  warning         TEXT
);

INSERT INTO color_rules (rule_name, hue_diff_min, hue_diff_max, harmony_score, suitable_occasions, warning) VALUES
('同色系',   0,    15,  7, ARRAY['work','formal','daily'], NULL),
('鄰近色',   15,   60,  8, ARRAY['casual','date','social'], NULL),
('對比色',   120,  150, 8, ARRAY['casual','party','social'], NULL),
('互補色',   150,  180, 9, ARRAY['party','date'], '建議點綴法或降飽和度'),
('無彩色',   NULL, NULL,8, ARRAY['work','formal','all'], NULL),
('大地色系', NULL, NULL,8, ARRAY['casual','daily'], NULL);

-- ─────────────────────────────────────────
-- 5. 十二色季表
-- ─────────────────────────────────────────
CREATE TABLE color_seasons (
  id           SERIAL PRIMARY KEY,
  season_key   VARCHAR(30) UNIQUE NOT NULL,
  season_name  VARCHAR(30) NOT NULL,
  family       VARCHAR(10) NOT NULL,
  undertone    VARCHAR(10) NOT NULL,
  clarity      VARCHAR(10) NOT NULL,
  best_colors  JSONB NOT NULL DEFAULT '[]',
  avoid_colors JSONB NOT NULL DEFAULT '[]',
  keywords     TEXT
);

INSERT INTO color_seasons (season_key, season_name, family, undertone, clarity, best_colors, avoid_colors, keywords) VALUES
('bright_spring','淨春型','spring','warm','bright','[{"hex":"#FF69B4"},{"hex":"#00CED1"},{"hex":"#FFF44F"}]','[{"hex":"#808080"}]','明亮活潑、溫暖、高對比'),
('true_spring',  '暖春型','spring','warm','bright','[{"hex":"#FF7F50"},{"hex":"#40E0D0"},{"hex":"#FFD700"}]','[{"hex":"#000080"}]','溫暖清澈、金色系'),
('light_spring', '淺春型','spring','warm','light', '[{"hex":"#FFCBA4"},{"hex":"#98FF98"},{"hex":"#ADD8E6"}]','[{"hex":"#000000"}]','糖果粉彩、輕盈'),
('light_summer', '淺夏型','summer','cool','light', '[{"hex":"#ADD8E6"},{"hex":"#FFB6C1"},{"hex":"#DDA0DD"}]','[{"hex":"#FF8C00"}]','輕透冷調粉彩'),
('true_summer',  '冷夏型','summer','cool','muted', '[{"hex":"#6F8FAF"},{"hex":"#708090"},{"hex":"#C21E56"}]','[{"hex":"#FF8C00"}]','冷灰中等飽和'),
('soft_summer',  '柔夏型','summer','cool','soft',  '[{"hex":"#B2AC88"},{"hex":"#6699CC"},{"hex":"#D4A5A5"}]','[{"hex":"#FFD700"}]','灰調霧面低對比'),
('soft_autumn',  '柔秋型','autumn','warm','soft',  '[{"hex":"#C2B280"},{"hex":"#9E7B4F"},{"hex":"#B7410E"}]','[{"hex":"#000000"}]','灰調大地色'),
('true_autumn',  '暖秋型','autumn','warm','muted', '[{"hex":"#FFDB58"},{"hex":"#FF7518"},{"hex":"#6F4E37"}]','[{"hex":"#000080"}]','豐富秋色、金飾首選'),
('deep_autumn',  '深秋型','autumn','warm','deep',  '[{"hex":"#3B1C08"},{"hex":"#8B2500"},{"hex":"#008080"}]','[{"hex":"#FFB6C1"}]','深沉飽和暖調'),
('deep_winter',  '深冬型','winter','cool','deep',  '[{"hex":"#000000"},{"hex":"#00008B"},{"hex":"#4B0082"}]','[{"hex":"#FFDB58"}]','極深冷色'),
('true_winter',  '冷冬型','winter','cool','bright','[{"hex":"#DC143C"},{"hex":"#0047AB"},{"hex":"#50C878"}]','[{"hex":"#FF7518"}]','純淨冷色高對比'),
('bright_winter','淨冬型','winter','cool','bright','[{"hex":"#BF00FF"},{"hex":"#00FFFF"},{"hex":"#FF0000"}]','[{"hex":"#808000"}]','明亮閃耀強對比');

-- ─────────────────────────────────────────
-- 6. 場合色彩策略表
-- ─────────────────────────────────────────
CREATE TABLE occasion_strategies (
  id              SERIAL PRIMARY KEY,
  occasion_key    VARCHAR(30) UNIQUE NOT NULL,
  occasion_name   VARCHAR(30) NOT NULL,
  primary_colors  JSONB NOT NULL DEFAULT '[]',
  accent_colors   JSONB NOT NULL DEFAULT '[]',
  goal            VARCHAR(100),
  color_formula   VARCHAR(100)
);

INSERT INTO occasion_strategies (occasion_key, occasion_name, primary_colors, accent_colors, goal, color_formula) VALUES
('work_interview',    '面試/初見客戶',   '[{"hex":"#1F3A5F"},{"hex":"#FFFFFF"}]','[]','信任、穩定、可靠','無彩色+低彩度重點色'),
('work_presentation', '高層演說',        '[{"hex":"#36454F"},{"hex":"#FFFFFF"}]','[{"hex":"#800020"}]','權威、成熟','深色主色+暖色點綴'),
('work_creative',     '創意提案',        '[{"hex":"#C0C0C0"}]','[{"hex":"#FFDB58"},{"hex":"#4169E1"}]','開放、創新','中性色+鮮明點綴'),
('work_daily',        '日常辦公',        '[{"hex":"#36454F"},{"hex":"#F5F5DC"}]','[]','沉穩耐看','無彩色為主'),
('date_first',        '初次約會',        '[{"hex":"#FF0000"},{"hex":"#FFC0CB"},{"hex":"#ADD8E6"}]','[]','吸引力/溫柔/信任','鄰近色+柔軟材質'),
('date_casual',       '輕鬆約會',        '[{"hex":"#FFC0CB"},{"hex":"#E6E6FA"}]','[]','溫柔親近',NULL),
('casual',            '日常休閒',        '[{"hex":"#C2B280"},{"hex":"#6B8E23"}]','[]','舒適自然',NULL),
('outdoor',           '戶外活動',        '[{"hex":"#F0E68C"},{"hex":"#228B22"}]','[]','自然大地感','大地色系'),
('party',             '派對/宴會',       '[{"hex":"#000000"},{"hex":"#FFD700"}]','[{"hex":"#DC143C"}]','華麗存在感','對比色+光澤材質'),
('sport',             '運動',            '[{"hex":"#000080"},{"hex":"#000000"}]','[{"hex":"#FF6347"}]','活力俐落',NULL);

-- ─────────────────────────────────────────
-- 7. 具體配色組合表（12組）
-- ─────────────────────────────────────────
CREATE TABLE color_combos (
  id                 SERIAL PRIMARY KEY,
  combo_name         VARCHAR(60) NOT NULL,
  colors             JSONB NOT NULL,
  suitable_undertone TEXT[] NOT NULL,
  occasions          TEXT[] NOT NULL,
  seasons            TEXT[] NOT NULL,
  suggested_items    TEXT,
  harmony_type       VARCHAR(20)
);

INSERT INTO color_combos (combo_name, colors, suitable_undertone, occasions, seasons, suggested_items, harmony_type) VALUES
('黑白金 高對比經典','[{"hex":"#000000"},{"hex":"#FFFFFF"},{"hex":"#FFD700"}]',ARRAY['cool','warm','neutral'],ARRAY['formal','party'],ARRAY['all'],'金屬色細肩帶洋裝+黑色外套','無彩色+點綴'),
('海軍藍+淺灰+米白','[{"hex":"#000080"},{"hex":"#D3D3D3"},{"hex":"#F5F5DC"}]',ARRAY['warm'],ARRAY['work','daily'],ARRAY['spring','autumn'],'米白襯衫+海軍藍西裝褲','同色系'),
('酒紅+石板灰+粉紅','[{"hex":"#800000"},{"hex":"#708090"},{"hex":"#FFC0CB"}]',ARRAY['warm','cool'],ARRAY['casual','date'],ARRAY['autumn','winter'],'酒紅針織上衣+灰色長裙','鄰近色'),
('米白+橄欖綠+巧克力棕','[{"hex":"#F5F5DC"},{"hex":"#808000"},{"hex":"#6B4423"}]',ARRAY['warm'],ARRAY['casual','outdoor'],ARRAY['autumn'],'橄欖綠針織衫+棕色長褲','大地色系'),
('粉紅+綠色+米白','[{"hex":"#FFC0CB"},{"hex":"#008000"},{"hex":"#F5F5DC"}]',ARRAY['cool','neutral'],ARRAY['casual'],ARRAY['spring','summer'],'淺綠印花裙+粉紅開衫','鄰近色'),
('淺粉+淡紫+淺綠','[{"hex":"#F6D1C1"},{"hex":"#E6E6FA"},{"hex":"#98FB98"}]',ARRAY['cool'],ARRAY['casual','date'],ARRAY['spring','summer'],'淺綠雪紡裙+粉紅針織衫','類比色'),
('珊瑚紅+檸檬黃+栗色','[{"hex":"#FF7F50"},{"hex":"#FFFACD"},{"hex":"#CD853F"}]',ARRAY['cool','warm','neutral'],ARRAY['casual'],ARRAY['spring','summer'],'珊瑚紅上衣+米白短裙','鄰近色'),
('深綠+卡其+巧克力棕','[{"hex":"#013220"},{"hex":"#F0E68C"},{"hex":"#6B4423"}]',ARRAY['warm'],ARRAY['casual'],ARRAY['autumn','winter'],'卡其風衣+深綠褲子','大地色系'),
('靛青+淡粉+白色','[{"hex":"#4B0082"},{"hex":"#FFB6C1"},{"hex":"#FFFFFF"}]',ARRAY['cool'],ARRAY['casual'],ARRAY['spring','summer'],'淡粉洋裝+白襯衫外套','對比色'),
('黑白 極簡通勤','[{"hex":"#000000"},{"hex":"#FFFFFF"}]',ARRAY['cool','warm','neutral'],ARRAY['work','formal'],ARRAY['all'],'白襯衫+黑西裝褲','無彩色'),
('酒紅+灰色+奶油白','[{"hex":"#722F37"},{"hex":"#808080"},{"hex":"#FFFDD0"}]',ARRAY['cool','warm'],ARRAY['casual','work'],ARRAY['autumn','winter'],'酒紅毛衣+灰色長裙','同色系'),
('藏青+駝色+米白','[{"hex":"#1F3A5F"},{"hex":"#C19A6B"},{"hex":"#F5F5DC"}]',ARRAY['cool','warm','neutral'],ARRAY['work','daily'],ARRAY['all'],'藏青外套+駝色褲子','對比色');

-- ─────────────────────────────────────────
-- 8. 2026 趨勢色表
-- ─────────────────────────────────────────
CREATE TABLE trend_colors (
  id           SERIAL PRIMARY KEY,
  year         SMALLINT NOT NULL,
  color_name   VARCHAR(50) NOT NULL,
  hex          CHAR(7) NOT NULL,
  role         VARCHAR(20),
  description  TEXT,
  pair_with    JSONB DEFAULT '[]'
);

INSERT INTO trend_colors (year, color_name, hex, role, description, pair_with) VALUES
(2026,'Transformative Teal','#008080','hero','深邃藍綠，冷暖膚色皆適用','[{"hex":"#6B4423"},{"hex":"#FFFDD0"},{"hex":"#FF7F50"}]'),
(2026,'Cloud Dancer','#F5F0E8','neutral','柔暖白（Pantone 11-4201），介於純白與香草色','[{"hex":"#E6E6FA"},{"hex":"#4B0082"}]'),
(2026,'Electric Fuchsia','#FF007F','accent','高彩度電感紫紅，10%點綴用','[{"hex":"#36454F"},{"hex":"#000000"}]'),
(2026,'Mocha Mousse','#C4956A','neutral','摩卡慕斯大地暖棕','[{"hex":"#FFFDD0"},{"hex":"#008080"}]');

-- ─────────────────────────────────────────
-- 9. 用戶色彩偏好表（v1.5 回饋機制）
-- ─────────────────────────────────────────
CREATE TABLE user_color_preferences (
  id            SERIAL PRIMARY KEY,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  rule_name     VARCHAR(50) NOT NULL,
  -- 對應 color_rules.rule_name
  weight_delta  DECIMAL(3,1) DEFAULT 0,
  -- 用戶 like/dislike 累積：+0.5 / -0.5；上限 ±3
  updated_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, rule_name)
);

-- ─────────────────────────────────────────
-- 10. 材質基礎特性表（20種）
-- ─────────────────────────────────────────
CREATE TABLE material_types (
  id              SERIAL PRIMARY KEY,
  material_key    VARCHAR(30) UNIQUE NOT NULL,
  material_name   VARCHAR(30) NOT NULL,
  gloss_level     VARCHAR(10) NOT NULL,  -- high/medium/low/none
  reflection      VARCHAR(15) NOT NULL,  -- specular/mixed/diffuse/transmit
  brightness_mod  DECIMAL(3,1) DEFAULT 0,
  saturation_mod  DECIMAL(3,1) DEFAULT 0,
  touch_quality   VARCHAR(30),
  best_saturation VARCHAR(10),
  keywords        TEXT
);

INSERT INTO material_types
  (material_key,material_name,gloss_level,reflection,brightness_mod,saturation_mod,touch_quality,best_saturation,keywords)
VALUES
('silk_satin',    '絲綢緞面',  'high',  'specular',+1.5,-0.8,'smooth_cool','medium','鏡面反射增亮，色彩純粹現代'),
('silk_crepe',    '絲綢雙縐',  'low',   'diffuse', +0.5,-0.3,'smooth_cool','medium','啞光珍珠光澤，柔和含蓄'),
('silk_georgette','絲綢喬其',  'none',  'transmit',-0.5,-0.5,'smooth_cool','low',   '透射朦朧，輕盈飄逸'),
('wool_fine',     '精紡羊毛',  'low',   'diffuse', -0.5,+0.8,'soft_warm',  'low',   '吸色量比棉多30%，深邃飽和'),
('wool_coarse',   '粗紡羊毛',  'none',  'diffuse', -1.0,+0.5,'rough_natural','low', '漫反射強，色彩豐富層次'),
('cashmere',      '羊絨',      'none',  'diffuse', -0.5,+0.6,'soft_warm',  'low',   '最細膩啞光，越好越素淡'),
('cotton',        '棉質',      'none',  'diffuse', -0.3,+0.2,'soft_warm',  'high',  '包容度高，可承載高飽和'),
('linen',         '亞麻',      'none',  'diffuse', -0.8,-0.2,'rough_natural','low',  '鮮豔色浮於表面，首選自然色'),
('cotton_linen',  '棉麻混紡',  'none',  'diffuse', -0.5,+0.1,'rough_natural','low', '兩者兼具，適合自然色'),
('leather_matte', '磨砂皮革',  'low',   'mixed',   +0.3,+0.3,'stiff_formal','medium','溫潤半啞光，深色呈沉穩張力'),
('leather_patent','漆皮',      'high',  'specular',+2.0,-1.0,'stiff_formal','low',   '近鏡面，色彩被銳化，建議基礎色'),
('knit_chunky',   '粗針織',    'none',  'diffuse', -1.2,-0.3,'soft_warm',  'low',   '肌理起伏大，適合低飽和色'),
('knit_fine',     '細針織',    'low',   'diffuse', -0.3,+0.3,'soft_warm',  'medium','比棉多絨感，可承載中高飽和'),
('acetate',       '醋酸面料',  'medium','mixed',   +0.8,-0.2,'smooth_cool','high',   '光澤隨光線變化，上色性極佳'),
('polyester',     '聚酯纖維',  'medium','mixed',    0.0, 0.0,'stiff_formal','medium','中規中矩，避免過鮮豔'),
('nylon',         '尼龍',      'medium','specular', +0.5,-0.3,'smooth_cool','medium','接近真絲光澤'),
('velvet',        '天鵝絨',    'medium','mixed',    -0.5,+1.0,'soft_warm',  'low',   '絨毛方向造成明暗，深色最佳'),
('denim',         '牛仔布',    'none',  'diffuse', -0.5,+0.3,'stiff_formal','medium','藍色系最穩定，可承載撞色'),
('chiffon',       '雪紡',      'none',  'transmit',-0.3,-0.4,'smooth_cool','low',   '半透明，色彩輕盈'),
('organza',       '歐根紗',    'high',  'transmit',+0.8,-0.5,'stiff_formal','low',   '硬挺透明，適合正式深色');

-- ─────────────────────────────────────────
-- 11. 材質×色彩四大交互法則表
-- ─────────────────────────────────────────
CREATE TABLE material_color_laws (
  id          SERIAL PRIMARY KEY,
  law_key     VARCHAR(30) UNIQUE NOT NULL,
  law_name    VARCHAR(40) NOT NULL,
  description TEXT NOT NULL,
  example     TEXT,
  occasions   TEXT[] DEFAULT '{}'
);

INSERT INTO material_color_laws (law_key, law_name, description, example, occasions) VALUES
('tonal_multi_material','同色異質法','同一色彩搭配不同材質，利用材質層次激活單色。低調奢華。','米白羊絨針織衫+米白真絲長裙',ARRAY['work','formal','date']),
('contrast_color_same_material','異色同質法','不同色彩保持相同材質，材質統一撞色。','鵝黃棉質襯衫+鈷藍棉質闊腿褲',ARRAY['casual','party']),
('gloss_contrast','光澤對比法','啞光與光澤並置，一推一收形成戲劇張力。','金色真絲裙+黑色羊絨打底',ARRAY['party','formal','date']),
('texture_contrast','肌理對比法','平滑與粗糙並置，同色產生同色異感。','米白棉質襯衫+米白粗針織開衫',ARRAY['casual','daily','work_creative']);

-- ─────────────────────────────────────────
-- 12. 色相對材質敏感度表
-- ─────────────────────────────────────────
CREATE TABLE hue_material_sensitivity (
  id           SERIAL PRIMARY KEY,
  color_family VARCHAR(20) NOT NULL,
  sensitivity  VARCHAR(10) NOT NULL,
  note         TEXT
);

INSERT INTO hue_material_sensitivity (color_family, sensitivity, note) VALUES
('blue',  'high',  '不同紋理下視覺色差最高，選材需特別注意'),
('grey',  'low',   '感知波動最小，是最安全的跨材質選擇'),
('yellow','low',   '色彩表現穩定，不同材質下偏差小'),
('red',   'medium','緞面強化攻擊性；啞光羊毛使紅色溫潤厚重'),
('green', 'medium','亞麻上最自然質樸；緞面上呈現寶石感'),
('white', 'high',  '光澤材質顯冷冽；棉麻顯清新；皮革顯前衛'),
('black', 'medium','各材質都穩定，但光澤度差異極大');

-- ─────────────────────────────────────────
-- 13. 場合×材質策略表
-- ─────────────────────────────────────────
CREATE TABLE occasion_material_strategy (
  id              SERIAL PRIMARY KEY,
  occasion_key    VARCHAR(30) NOT NULL,
  occasion_name   VARCHAR(30) NOT NULL,
  color_strategy  TEXT NOT NULL,
  material_combo  TEXT NOT NULL,
  interaction_effect TEXT NOT NULL
);

INSERT INTO occasion_material_strategy (occasion_key,occasion_name,color_strategy,material_combo,interaction_effect) VALUES
('work_interview', '商務職場','中性色+低飽和重點色','精紡羊毛西裝+真絲雙縐襯衫','啞光沉穩+柔和光澤，專業優雅'),
('casual',         '休閒日常','自然色系','棉麻+粗針織','肌理自然化色彩'),
('date_first',     '約會聚會','低明度暖色','真絲雙縐或醋酸+皮革配飾','啞光珍珠光澤+皮革點綴'),
('party',          '晚宴派對','金屬色+深色','真絲緞面+漆皮+金屬飾品','光澤疊加，燈光下流動'),
('work_creative',  '文藝休閒','莫蘭迪色系','亞麻+粗針織羊毛','啞光+肌理雙重柔化');

-- ─────────────────────────────────────────
-- 14. 廓形×體型修飾規則表
-- ─────────────────────────────────────────
CREATE TABLE silhouette_body_rules (
  id           SERIAL PRIMARY KEY,
  body_type    VARCHAR(20) NOT NULL,
  category     VARCHAR(20) NOT NULL,  -- 'top_outer' | 'bottom'
  recommended  TEXT[] NOT NULL,
  avoid        TEXT[] NOT NULL,
  reason       TEXT
);

INSERT INTO silhouette_body_rules (body_type,category,recommended,avoid,reason) VALUES
('upper_heavy','top_outer',ARRAY['regular','slim','wrap'],ARRAY['oversized','peplum','off_shoulder'],'修身或wrap收腰強調腰線'),
('upper_heavy','bottom',   ARRAY['wide_leg','a_line','straight'],ARRAY['pencil','slim_fit'],'下半身寬鬆平衡視覺'),
('pear_shape', 'top_outer',ARRAY['oversized','peplum','off_shoulder','cropped'],ARRAY['slim','wrap'],'上半身寬鬆轉移視覺焦點'),
('pear_shape', 'bottom',   ARRAY['a_line','wide_leg','maxi'],ARRAY['pencil','slim_fit','mini'],'A字裙自然遮蓋臀部線條'),
('balanced',   'top_outer',ARRAY['oversized','regular','slim','cropped','wrap','peplum'],ARRAY[],'均衡體型可自由選擇'),
('balanced',   'bottom',   ARRAY['wide_leg','straight','a_line','slim_fit','pencil','mini','maxi'],ARRAY[],'無特別限制');

-- ─────────────────────────────────────────
-- 15. 廓形×場合適配表
-- ─────────────────────────────────────────
CREATE TABLE silhouette_occasion_rules (
  id                  SERIAL PRIMARY KEY,
  occasion_key        VARCHAR(30) NOT NULL,
  top_silhouettes     TEXT[] NOT NULL,
  bottom_silhouettes  TEXT[] NOT NULL
);

INSERT INTO silhouette_occasion_rules (occasion_key,top_silhouettes,bottom_silhouettes) VALUES
('work_interview',    ARRAY['regular','slim','wrap'],         ARRAY['straight','slim_fit','pencil']),
('work_presentation', ARRAY['slim','regular'],                ARRAY['pencil','straight']),
('work_creative',     ARRAY['oversized','regular','cropped'], ARRAY['wide_leg','a_line','straight']),
('work_daily',        ARRAY['regular','slim','wrap'],         ARRAY['straight','wide_leg','slim_fit']),
('date_first',        ARRAY['wrap','off_shoulder','slim','peplum'],ARRAY['a_line','pencil']),
('date_casual',       ARRAY['regular','oversized','cropped'], ARRAY['a_line','wide_leg','mini']),
('casual',            ARRAY['oversized','regular','cropped'], ARRAY['wide_leg','straight','a_line']),
('outdoor',           ARRAY['regular','oversized'],           ARRAY['straight','wide_leg']),
('party',             ARRAY['off_shoulder','slim','peplum','cropped'],ARRAY['mini','pencil','maxi']),
('sport',             ARRAY['regular','slim'],                ARRAY['straight','slim_fit']);

-- ─────────────────────────────────────────
-- 16. 廓形搭配組合評分表（上衣×下身）
-- ─────────────────────────────────────────
CREATE TABLE silhouette_combo_rules (
  id          SERIAL PRIMARY KEY,
  top_sil     VARCHAR(20) NOT NULL,
  bottom_sil  VARCHAR(20) NOT NULL,
  score       SMALLINT NOT NULL,
  principle   VARCHAR(30),
  note        TEXT
);

INSERT INTO silhouette_combo_rules (top_sil,bottom_sil,score,principle,note) VALUES
('slim',      'wide_leg', 10,'fitted_x_volume','最經典比例，各場合皆適用'),
('slim',      'a_line',    9,'fitted_x_volume','修身+A字裙，優雅女性線條'),
('slim',      'maxi',      9,'fitted_x_volume','修身+長裙，高挑顯瘦'),
('slim',      'slim_fit',  6,'tonal',          '全修身需靠材質色彩創造層次'),
('cropped',   'wide_leg', 10,'fitted_x_volume','短版+闊腿褲，近年最流行比例'),
('cropped',   'a_line',    9,'fitted_x_volume','短版+A字裙，甜美有層次'),
('cropped',   'maxi',      8,'fitted_x_volume','短版+長裙，極端比例時髦感'),
('oversized', 'slim_fit',  9,'fitted_x_volume','oversize+窄管，當代流行'),
('oversized', 'pencil',    8,'fitted_x_volume','oversize+包臀，強烈對比'),
('oversized', 'wide_leg',  5,'tonal',          '全寬鬆易顯邋遢，需腰帶救場'),
('oversized', 'a_line',    4,'contrast',       '上下均寬鬆，視覺重量失衡'),
('regular',   'wide_leg',  8,'fitted_x_volume','基本百搭組合'),
('regular',   'a_line',    8,'fitted_x_volume','基本百搭組合'),
('regular',   'straight',  7,'tonal',          '中性組合，不出錯但不突出'),
('wrap',      'slim_fit',  9,'fitted_x_volume','wrap收腰+窄管，展現腰線'),
('wrap',      'pencil',    9,'fitted_x_volume','wrap+鉛筆裙，強調沙漏比例'),
('peplum',    'slim_fit',  9,'fitted_x_volume','peplum天生配窄版下身'),
('peplum',    'pencil',    9,'fitted_x_volume','腰部荷葉+包臀，強調沙漏'),
('off_shoulder','wide_leg',7,'fitted_x_volume','露肩+闊腿，注意腰線定義');

-- ─────────────────────────────────────────
-- 17. 材質×體型修飾強化表
-- ─────────────────────────────────────────
CREATE TABLE material_body_rules (
  id           SERIAL PRIMARY KEY,
  body_type    VARCHAR(20) NOT NULL,
  rule         TEXT NOT NULL,
  material_tip TEXT
);

INSERT INTO material_body_rules (body_type,rule,material_tip) VALUES
('upper_heavy','上身選深色/啞光材質，下身選淺色/光澤材質','上：棉/亞麻/粗針織；下：醋酸/細針織'),
('pear_shape', '上身選淺色/光澤/厚實材質，下身選深色/啞光','上：真絲緞面/醋酸；下：精紡羊毛/棉'),
('balanced',   '自由選材，優先考慮場合需求','同色異質法最容易展現整體協調感');

-- ─────────────────────────────────────────
-- 18. 圖案規則表
-- ─────────────────────────────────────────
CREATE TABLE pattern_rules (
  id           SERIAL PRIMARY KEY,
  pattern_type VARCHAR(20) UNIQUE NOT NULL,
  pairing_rule TEXT NOT NULL,
  color_tip    TEXT
);

INSERT INTO pattern_rules (pattern_type, pairing_rule, color_tip) VALUES
('solid',       '素色可與任何圖案搭配，是萬用底色', '顏色選擇最自由'),
('stripe',      '條紋搭素色；條紋方向要一致，避免兩件條紋疊穿', '選條紋中的一個顏色作為素色單品的配色'),
('check',       '格紋搭素色；格紋+條紋容易混亂', '選格紋背景色作為配對素色'),
('dot',         '圓點搭素色；小點可與細條紋搭配', '選點的顏色呼應其他單品'),
('floral',      '碎花搭素色，取花中主色做呼應；花×花絕對不行', '從碎花中提取一色作為素色單品配色'),
('geometric',   '幾何圖案搭素色；強烈幾何可搭細條紋', '幾何圖案已有設計感，配色選中性色'),
('abstract',    '抽象圖案搭素色中性色，讓圖案說話', '選圖案中最低調的顏色作配對色'),
('print_multi', '多色印花搭素色，取印花中最低調的顏色做配對', '避免再加任何有色圖案');
