# WARDROBE AI — CLAUDE.md  v3.2 最終版
# 把此檔放在專案根目錄，Claude Code 自動讀取

## 專案簡介
女性衣橱管理 App。推薦引擎基於色彩/材質/廓形研究報告規則庫，**零 AI API 費用**。
技術棧：Node.js + Express + PostgreSQL + React Native (Expo)

## 目錄結構
```
wardrobe-app/
├── db/
│   └── schema_final.sql         ← 執行此檔建立全部18張表
├── engine/
│   ├── recommender.js           ← 主推薦引擎（三維評分）
│   ├── material_scorer.js       ← 材質評分模組
│   └── silhouette_scorer.js     ← 廓形評分模組
├── api/
│   └── routes.js                ← Express 路由（含 Rate Limit + JWT）
├── mobile/                      ← React Native (Expo)
├── .env                         ← 環境變數（見下方）
└── CLAUDE.md                    ← 本檔案
```

---

## ❌ 禁止事項（違反即停止）
1. **不可**呼叫任何 AI API（OpenAI / Gemini / Anthropic）做推薦計算
2. **不可**刪除 schema_final.sql 中的規則預填資料
3. **不可**在 recommender.js / material_scorer.js / silhouette_scorer.js 外重複實作評分邏輯
4. **不可**使用字串拼接 SQL（一律 parameterized query）
5. **不可**更改下方任何固定值域的枚舉值
6. **不可**移除 JWT auth 中間件（/auth/* 和 /meta/* 除外）

---

## 固定值域（所有欄位的允許值）

| 欄位 | 允許值 |
|------|--------|
| `category` | `inner_top` / `top` / `outer` / `bottom` / `accessory` |
| `layer_order` | `1`（內搭）/ `2`（上衣）/ `3`（外套）|
| `fit_type` | `oversized` / `slim` / `regular` / `cropped` |
| `silhouette`（上衣/外套）| `oversized` / `regular` / `slim` / `cropped` / `peplum` / `wrap` / `off_shoulder` |
| `silhouette`（下身）| `wide_leg` / `straight` / `slim_fit` / `a_line` / `pencil` / `mini` / `maxi` |
| `material_key` | `silk_satin` / `silk_crepe` / `silk_georgette` / `wool_fine` / `wool_coarse` / `cashmere` / `cotton` / `linen` / `cotton_linen` / `leather_matte` / `leather_patent` / `knit_chunky` / `knit_fine` / `acetate` / `polyester` / `nylon` / `velvet` / `denim` / `chiffon` / `organza` |
| `pattern_type` | `solid` / `stripe` / `check` / `dot` / `floral` / `geometric` / `abstract` / `print_multi` |
| `drape_level` | `high` / `medium` / `low` / `none` |
| `skin_tone` | `cool_white` / `warm_yellow` / `wheat_tan` / `neutral` |
| `body_type` | `upper_heavy` / `pear_shape` / `balanced` |
| `occasion` | `work_interview` / `work_presentation` / `work_creative` / `work_daily` / `date_first` / `date_casual` / `casual` / `outdoor` / `party` / `sport` |
| `season` | `spring` / `summer` / `autumn` / `winter` |
| `color_season` | `bright_spring` / `true_spring` / `light_spring` / `light_summer` / `true_summer` / `soft_summer` / `soft_autumn` / `true_autumn` / `deep_autumn` / `deep_winter` / `true_winter` / `bright_winter` |

---

## clothing_items.colors 格式（JSONB）
```json
[{ "hex": "#FF7F50", "ratio": 0.6 }, { "hex": "#FFFFFF", "ratio": 0.4 }]
```
- 按面積佔比由大到小排序
- `colors[0]` 為主色，存入時同步計算 `hsl_h` / `hsl_s` / `hsl_l`
- `colors[0].ratio < 0.35` → `is_pattern = true`

---

## 推薦引擎架構（三維評分）

### 最終評分公式
```
最終分數 = 色彩分 × 0.50 + 材質分 × 0.25 + 廓形分 × 0.25
```

### 色彩評分（recommender.js）
- 三維：色相差（×0.5）+ 飽和度調整（×0.3）+ 明度對比（×0.2）
- 動態季節權重：spring/summer 外層55%/內層45%；autumn/winter 外層70%/內層30%
- 多層加成 +0.5；用戶個人權重（v1.5）

### 材質評分（material_scorer.js）
- 四大交互法則：同色異質(+0.5) / 異色同質(+0.3) / 光澤對比(+0.5) / 肌理對比(+0.3)
- 材質×色彩相容性懲罰（低飽和材質配高飽和色 -1.0）
- 材質×場合加分（+0.3）

### 廓形評分（silhouette_scorer.js）
- 組合評分：slim×wide_leg 和 cropped×wide_leg 滿分10
- 體型加分：符合 upper_heavy/pear_shape 規則 +0.5，違反 -0.8
- 場合加分：+0.3

### 降級機制（場合永遠不放寬）
- Lv0 正常 → Lv1 放寬季節 → Lv2 分數≥0.5 → Lv3 歷史記錄 → Lv4 冷啟動

---

## API 規範
- `/wardrobe` / `/recommend` / `/outfits` → 必須 JWT auth
- `/auth/*` / `/meta/*` → 不需驗證
- Rate Limit：`/auth/login` 5次/分/IP；`/recommend` 30次/分/用戶
- JWT：`access_token` 7d + `refresh_token` 30d
- `POST /recommend` 必須回傳 `accessories`（hat/shoes/bag hex）+ `analysis`

---

## .env 必要變數
```
DATABASE_URL=postgresql://user:pass@localhost:5432/wardrobe
JWT_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
PORT=3000
```

---

## 開發進度 Checklist
- [x] schema_final.sql（18 張表 + 所有規則預填）
- [x] recommender.js（三維評分 + 4級降級）
- [x] material_scorer.js（20種材質 + 4大法則）
- [x] silhouette_scorer.js（廓形組合 + 體型修飾）
- [x] routes.js（完整 API + Rate Limit + JWT Refresh）
- [x] 執行 schema_final.sql 建立資料庫
- [x] 安裝依賴：npm install express pg bcrypt jsonwebtoken express-rate-limit
- [x]驗收測試（見 TASK.md）
- [x] React Native 前端 — 衣橱頁（含 material_key / silhouette 下拉選單）
- [x] React Native 前端 — 推薦頁
- [x] React Native 前端 — 穿搭紀錄頁
- [x] K-means 顏色辨識（200×200 + 取色框 + 二次確認）
- [x] expo-image-manipulator WebP 壓縮
- [x] 3 題色季快速測驗
- [ ] App Store / Play Store 上架
