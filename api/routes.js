/**
 * WARDROBE AI — api/routes.js  v3.2 最終版
 * Express 路由：含 Rate Limit + JWT 雙 Token + 完整驗證
 */

const express       = require('express');
const jwt           = require('jsonwebtoken');
const bcrypt        = require('bcryptjs');
const rateLimit     = require('express-rate-limit');
const { Pool }      = require('pg');
const { generateRecommendations } = require('../engine/recommender');

const router = express.Router();
const pool   = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : false,
});

const ACCESS_SECRET  = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// ─────────────────────────────────────────
// 固定值域（驗證用）
// ─────────────────────────────────────────
const VALID = {
  category:    ['inner_top','top','outer','bottom','accessory'],
  layer_order: [1,2,3],
  fit_type:    ['oversized','slim','regular','cropped'],
  silhouette_top:['oversized','regular','slim','cropped','peplum','wrap','off_shoulder'],
  silhouette_bot:['wide_leg','straight','slim_fit','a_line','pencil','mini','maxi'],
  material_key:['silk_satin','silk_crepe','silk_georgette','wool_fine','wool_coarse',
                'cashmere','cotton','linen','cotton_linen','leather_matte','leather_patent',
                'knit_chunky','knit_fine','acetate','polyester','nylon','velvet','denim','chiffon','organza'],
  pattern_type:['solid','stripe','check','dot','floral','geometric','abstract','print_multi'],
  drape_level: ['high','medium','low','none'],
  style_tags:  ['casual','work','formal','date','sport','outdoor','all'],
  season_tags: ['spring','summer','autumn','winter','all'],
  skin_tone:   ['cool_white','warm_yellow','wheat_tan','neutral'],
  body_type:   ['upper_heavy','pear_shape','balanced'],
  occasion:    ['work_interview','work_presentation','work_creative','work_daily',
                'date_first','date_casual','casual','outdoor','party','sport'],
  season:      ['spring','summer','autumn','winter'],
  color_season:['bright_spring','true_spring','light_spring','light_summer','true_summer',
                'soft_summer','soft_autumn','true_autumn','deep_autumn','deep_winter',
                'true_winter','bright_winter'],
};

// ─────────────────────────────────────────
// Rate Limit 設定
// ─────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 60*1000, max: 5,
  message: { error: '登入嘗試過於頻繁，請稍後再試' }
});

const recommendLimiter = rateLimit({
  windowMs: 60*1000, max: 30,
  keyGenerator: (req) => req.user?.userId ?? (req.ip || 'unknown').replace(/^::ffff:/, ''),
  validate: { keyGeneratorIpFallback: false },
  message: { error: '推薦請求過於頻繁，請稍後再試' }
});

// ─────────────────────────────────────────
// JWT 中間件
// ─────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: '未授權' });
  try {
    req.user = jwt.verify(token, ACCESS_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token 無效或已過期，請使用 /auth/refresh 換發' });
  }
}

// ─────────────────────────────────────────
// 帳號 API
// ─────────────────────────────────────────

// POST /auth/register
router.post('/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: '請提供 email 和 password' });
    if (password.length < 8) return res.status(400).json({ error: 'password 最少 8 字元' });

    const exists = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (exists.rows.length > 0) return res.status(409).json({ error: 'Email 已被註冊' });

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
      [email, hash]
    );
    res.status(201).json({ message: '註冊成功', userId: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// POST /auth/login
router.post('/auth/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: '帳號或密碼錯誤' });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: '帳號或密碼錯誤' });

    const access_token  = jwt.sign({ userId: user.id, email: user.email }, ACCESS_SECRET,  { expiresIn: '7d' });
    const refresh_token = jwt.sign({ userId: user.id },                     REFRESH_SECRET, { expiresIn: '30d' });

    res.json({ access_token, refresh_token, message: '登入成功' });
  } catch (err) {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// POST /auth/refresh
router.post('/auth/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ error: '請提供 refresh_token' });

    const payload = jwt.verify(refresh_token, REFRESH_SECRET);
    const result  = await pool.query('SELECT id, email FROM users WHERE id=$1', [payload.userId]);
    if (result.rows.length === 0) return res.status(401).json({ error: '用戶不存在' });

    const user = result.rows[0];
    const access_token = jwt.sign({ userId: user.id, email: user.email }, ACCESS_SECRET, { expiresIn: '7d' });
    res.json({ access_token });
  } catch {
    res.status(401).json({ error: 'refresh_token 無效或已過期，請重新登入' });
  }
});

// PATCH /auth/profile
router.patch('/auth/profile', auth, async (req, res) => {
  try {
    const { color_season, skin_tone, body_type } = req.body;
    if (color_season && !VALID.color_season.includes(color_season))
      return res.status(400).json({ error: `color_season 無效，允許值：${VALID.color_season.join('/')}` });
    if (skin_tone && !VALID.skin_tone.includes(skin_tone))
      return res.status(400).json({ error: `skin_tone 無效，允許值：${VALID.skin_tone.join('/')}` });
    if (body_type && !VALID.body_type.includes(body_type))
      return res.status(400).json({ error: `body_type 無效，允許值：${VALID.body_type.join('/')}` });

    await pool.query(
      'UPDATE users SET color_season=$1, skin_tone=$2, body_type=$3 WHERE id=$4',
      [color_season, skin_tone, body_type, req.user.userId]
    );
    res.json({ message: '個人資料已更新' });
  } catch (err) {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// ─────────────────────────────────────────
// 衣物 API
// ─────────────────────────────────────────

// GET /wardrobe
router.get('/wardrobe', auth, async (req, res) => {
  try {
    const { category, season } = req.query;
    let query = 'SELECT * FROM clothing_items WHERE user_id=$1';
    const params = [req.user.userId];
    if (category) { query += ` AND category=$${params.length+1}`; params.push(category); }
    if (season)   { query += ` AND $${params.length+1}=ANY(season_tags)`; params.push(season); }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json({ items: result.rows });
  } catch (err) {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// POST /wardrobe
router.post('/wardrobe', auth, async (req, res) => {
  try {
    const {
      image_url, name, category, layer_order,
      colors, fit_type, silhouette,
      material_key, pattern_type, drape_level,
      style_tags, season_tags
    } = req.body;

    // 驗證必填
    if (!category || !VALID.category.includes(category))
      return res.status(400).json({ error: `category 無效，允許值：${VALID.category.join('/')}` });
    if (!Array.isArray(colors) || colors.length === 0)
      return res.status(400).json({ error: 'colors 必須是 [{ hex, ratio }] 陣列' });

    // 選填驗證
    if (fit_type    && !VALID.fit_type.includes(fit_type))
      return res.status(400).json({ error: `fit_type 無效` });
    if (material_key && !VALID.material_key.includes(material_key))
      return res.status(400).json({ error: `material_key 無效` });
    if (pattern_type && !VALID.pattern_type.includes(pattern_type))
      return res.status(400).json({ error: `pattern_type 無效` });

    // 計算主色 HSL
    const mainColor = [...colors].sort((a,b) => (b.ratio||0)-(a.ratio||0))[0];
    const hex = mainColor?.hex || '#808080';
    const hslRaw = hexToHslInternal(hex);
    const hsl_h  = Math.round(hslRaw.h);
    const hsl_s  = Math.round(hslRaw.s);
    const hsl_l  = Math.round(hslRaw.l);

    // is_pattern 判斷
    const is_pattern = (mainColor?.ratio || 1) < 0.35;

    const result = await pool.query(
      `INSERT INTO clothing_items
        (user_id, image_url, name, category, layer_order, colors,
         hsl_h, hsl_s, hsl_l, is_pattern,
         fit_type, silhouette, material_key, pattern_type, drape_level,
         style_tags, season_tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [req.user.userId, image_url, name, category,
       ['inner_top','top','outer'].includes(category) ? (layer_order||2) : null,
       JSON.stringify(colors), hsl_h, hsl_s, hsl_l, is_pattern,
       fit_type||'regular', silhouette||'regular',
       material_key||'cotton', pattern_type||'solid', drape_level||'medium',
       style_tags||[], season_tags||[]]
    );
    res.status(201).json({ message: '衣物已新增', item: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// DELETE /wardrobe/:id
router.delete('/wardrobe/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM clothing_items WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.user.userId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: '衣物不存在或無權限刪除' });
    res.json({ message: '衣物已刪除' });
  } catch (err) {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// ─────────────────────────────────────────
// 推薦 API
// ─────────────────────────────────────────

// 依伺服器月份自動判斷當季
function currentSeason() {
  const m = new Date().getMonth() + 1;
  if (m >= 3 && m <= 5)  return 'spring';
  if (m >= 6 && m <= 8)  return 'summer';
  if (m >= 9 && m <= 11) return 'autumn';
  return 'winter';
}

// POST /recommend
router.post('/recommend', auth, recommendLimiter, async (req, res) => {
  try {
    const { occasion = 'casual', season = currentSeason(), top_n = 3 } = req.body;

    if (!VALID.occasion.includes(occasion))
      return res.status(400).json({ error: `occasion 無效，允許值：${VALID.occasion.join('/')}` });
    if (!VALID.season.includes(season))
      return res.status(400).json({ error: `season 無效，允許值：${VALID.season.join('/')}` });

    // 取用戶資料
    const userRes = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.userId]);
    const user    = userRes.rows[0];

    // 取用戶衣橱
    const wardrobeRes = await pool.query(
      'SELECT * FROM clothing_items WHERE user_id=$1',
      [req.user.userId]
    );

    // 取用戶個人色彩偏好（v1.5）
    const prefsRes = await pool.query(
      'SELECT rule_name, weight_delta FROM user_color_preferences WHERE user_id=$1',
      [req.user.userId]
    );
    const userPrefs = {};
    prefsRes.rows.forEach(r => { userPrefs[r.rule_name] = parseFloat(r.weight_delta); });

    // 取穿搭歷史（降級 Lv3 用）
    const histRes = await pool.query(
      'SELECT * FROM outfit_records WHERE user_id=$1 ORDER BY worn_date DESC LIMIT 50',
      [req.user.userId]
    );

    const result = generateRecommendations({
      wardrobe:      wardrobeRes.rows,
      occasion, season,
      colorSeason:   user.color_season || null,
      skinTone:      user.skin_tone    || 'neutral',
      bodyType:      user.body_type    || 'balanced',
      userPrefs,
      topN:          Math.min(top_n, 10),
      outfitHistory: histRes.rows,
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// ─────────────────────────────────────────
// 穿搭紀錄 API
// ─────────────────────────────────────────

// POST /outfits
router.post('/outfits', auth, async (req, res) => {
  try {
    const { worn_date, occasion, season, layer_ids, bottom_id,
            accessory_ids, hat_color_hex, shoes_color_hex, bag_color_hex,
            user_score, is_ai_suggested } = req.body;

    if (!worn_date) return res.status(400).json({ error: '請提供 worn_date' });

    await pool.query(
      `INSERT INTO outfit_records
        (user_id, worn_date, occasion, season, layer_ids, bottom_id,
         accessory_ids, hat_color_hex, shoes_color_hex, bag_color_hex,
         user_score, is_ai_suggested)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [req.user.userId, worn_date, occasion, season,
       layer_ids||[], bottom_id, accessory_ids||[],
       hat_color_hex, shoes_color_hex, bag_color_hex,
       user_score||null, is_ai_suggested||false]
    );
    res.status(201).json({ message: '穿搭紀錄已儲存' });
  } catch (err) {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// GET /outfits
router.get('/outfits', auth, async (req, res) => {
  try {
    const { from, to, occasion } = req.query;
    let query  = 'SELECT * FROM outfit_records WHERE user_id=$1';
    const params = [req.user.userId];
    if (from)     { query += ` AND worn_date >= $${params.length+1}`; params.push(from); }
    if (to)       { query += ` AND worn_date <= $${params.length+1}`; params.push(to); }
    if (occasion) { query += ` AND occasion=$${params.length+1}`;     params.push(occasion); }
    query += ' ORDER BY worn_date DESC LIMIT 100';
    const result = await pool.query(query, params);
    res.json({ records: result.rows });
  } catch (err) {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// POST /outfits/feedback（v1.5 回饋機制）
router.post('/outfits/feedback', auth, async (req, res) => {
  try {
    const { rule_name, action } = req.body;
    // action: 'like' | 'dislike'
    if (!['like','dislike'].includes(action))
      return res.status(400).json({ error: 'action 必須為 like 或 dislike' });

    const delta = action === 'like' ? 0.5 : -0.5;
    await pool.query(
      `INSERT INTO user_color_preferences (user_id, rule_name, weight_delta)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, rule_name)
       DO UPDATE SET weight_delta = LEAST(3, GREATEST(-3,
         user_color_preferences.weight_delta + $3
       )), updated_at = NOW()`,
      [req.user.userId, rule_name, delta]
    );
    res.json({ message: `已記錄 ${action}，${rule_name} 權重調整 ${delta}` });
  } catch (err) {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// ─────────────────────────────────────────
// 參考資料 API（無需登入）
// ─────────────────────────────────────────

router.get('/meta/seasons', async (req, res) => {
  const result = await pool.query('SELECT season_key, season_name, family, undertone, clarity, keywords FROM color_seasons ORDER BY family, id');
  res.json({ seasons: result.rows });
});

router.get('/meta/occasions', async (req, res) => {
  const result = await pool.query('SELECT occasion_key, occasion_name, goal FROM occasion_strategies');
  res.json({ occasions: result.rows });
});

router.get('/meta/materials', async (req, res) => {
  const result = await pool.query('SELECT material_key, material_name, gloss_level, touch_quality, best_saturation FROM material_types');
  res.json({ materials: result.rows });
});

router.get('/meta/demo-wardrobe', async (req, res) => {
  // 冷啟動範例衣橱（3 組示範穿搭）
  res.json({
    message: '以下為示範穿搭，上傳第一件衣物後自動隱藏',
    demos: [
      {
        occasion: 'work_daily',
        layers:   [{ name:'米白素縐緞襯衫', category:'top',   mainColor:'#F5F5DC', material:'silk_crepe',  silhouette:'regular' }],
        bottom:   { name:'海軍藍直筒褲',   category:'bottom', mainColor:'#000080', material:'wool_fine',   silhouette:'straight' },
        accessories: { hat:'#000080', shoes:'#000080', bag:'#000080' },
        rule: '同色系', tip: '冷調色季首選，專業且優雅'
      },
      {
        occasion: 'date_first',
        layers:   [{ name:'淡粉醋酸緞衫',  category:'top',   mainColor:'#F6D1C1', material:'acetate',     silhouette:'wrap' }],
        bottom:   { name:'酒紅A字裙',      category:'bottom', mainColor:'#722F37', material:'wool_fine',   silhouette:'a_line' },
        accessories: { hat:'#722F37', shoes:'#FF007F', bag:'#FF007F' },
        rule: '鄰近色', tip: '醋酸光澤增加曖昧感，2026 Fuchsia 配件點綴'
      },
      {
        occasion: 'casual',
        layers:   [{ name:'白色棉質T恤',   category:'top',    mainColor:'#FFFFFF', material:'cotton',      silhouette:'regular' },
                   { name:'橄欖綠亞麻外套',category:'outer',  mainColor:'#808000', material:'linen',       silhouette:'oversized' }],
        bottom:   { name:'奶茶色闊腿褲',   category:'bottom', mainColor:'#C4956A', material:'cotton_linen',silhouette:'wide_leg' },
        accessories: { hat:'#C4956A', shoes:'#008080', bag:'#008080' },
        rule: '大地色系', tip: '同色異質法：白棉+亞麻+棉麻三種材質的米白系層次'
      },
    ]
  });
});

// ─────────────────────────────────────────
// 內部工具（避免重複 import）
// ─────────────────────────────────────────
function hexToHslInternal(hex) {
  let r=parseInt(hex.slice(1,3),16)/255, g=parseInt(hex.slice(3,5),16)/255, b=parseInt(hex.slice(5,7),16)/255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h,s, l=(max+min)/2;
  if(max===min){h=s=0;}else{
    const d=max-min; s=l>0.5?d/(2-max-min):d/(max+min);
    switch(max){case r:h=((g-b)/d+(g<b?6:0))/6;break;case g:h=((b-r)/d+2)/6;break;case b:h=((r-g)/d+4)/6;break;}
  }
  return {h:h*360,s:s*100,l:l*100};
}

module.exports = router;
