# WARDROBE AI — TASK.md  v3.2 最終版
# Claude Code 使用方式：「執行 TASK.md 的下一個未完成任務」

---

## 使用規則
- 每次只執行一個任務，完成後標記 [x]
- 遇到問題先看 CLAUDE.md 的禁止事項與固定值域
- 完成 P0 全部後才開始 P1

---

## P0-1  安裝環境與資料庫

- [x] **1.1** 安裝依賴：
  ```bash
  npm install express pg bcrypt jsonwebtoken express-rate-limit dotenv
  ```

- [x] **1.2** 建立 `.env` 檔案，填入所有必要變數（參考 CLAUDE.md）

- [x] **1.3** 執行 `db/schema_final.sql`，確認 18 張表全部建立：
  - users / clothing_items / outfit_records
  - color_rules（6筆）/ color_seasons（12筆）/ occasion_strategies（10筆）
  - color_combos（12筆）/ trend_colors（4筆）
  - user_color_preferences
  - material_types（20筆）/ material_color_laws（4筆）/ hue_material_sensitivity（7筆）
  - occasion_material_strategy（5筆）/ material_body_rules（3筆）
  - silhouette_body_rules（6筆）/ silhouette_occasion_rules（10筆）
  - silhouette_combo_rules（19筆）/ pattern_rules（8筆）

---

## P0-2  後端 API 補全

- [x] **2.1** 確認 `engine/` 目錄有三個檔案：
  - `recommender.js`
  - `material_scorer.js`
  - `silhouette_scorer.js`

- [x] **2.2** 確認 `api/routes.js` 有 Rate Limit 和 JWT Refresh

- [x] **2.3** 建立 Express 入口 `server.js`：
  ```js
  require('dotenv').config();
  const express = require('express');
  const routes  = require('./api/routes');
  const app     = express();
  app.use(express.json());
  app.use('/api', routes);
  app.listen(process.env.PORT || 3000, () => console.log('Server running'));
  ```

- [x] **2.4** 啟動伺服器：`node server.js`，確認無錯誤

---

## P0-3  驗收測試

- [x] **3.1** 完整流程測試（Postman 或 curl）：
  ```
  POST /api/auth/register  →  201 成功
  POST /api/auth/login     →  取得 access_token + refresh_token
  POST /api/wardrobe       →  新增 5 件衣物（各不同 category / material / silhouette）
  GET  /api/wardrobe       →  確認 5 件衣物回傳
  POST /api/recommend      →  { occasion:"work_daily", season:"autumn" }
                           →  確認回傳 3 套推薦，每套包含 accessories + analysis
  ```

- [x] **3.2** 三維分析驗證：
  - 確認每套推薦包含 `analysis.color.rule`
  - 確認每套推薦包含 `analysis.material.laws`
  - 確認每套推薦包含 `analysis.silhouette.principle`

- [x] **3.3** 降級測試：
  - 新帳號只加 1 件衣物，呼叫 /recommend
  - 確認不報錯，且 `fallback_level > 0`

- [x] **3.4** Rate Limit 測試：
  - 連續呼叫 `/api/auth/login` 6 次
  - 確認第 6 次回傳 429

- [x] **3.5** JWT Refresh 測試：
  - 用舊 access_token 呼叫 /api/wardrobe → 401
  - POST /api/auth/refresh（帶 refresh_token）→ 取得新 access_token
  - 用新 access_token 呼叫 /api/wardrobe → 200

- [x] **3.6** 冷啟動測試：
  - GET /api/meta/demo-wardrobe → 確認回傳 3 組示範穿搭

- [x] **3.7** SQL 安全確認：
  ```bash
  grep -rn "query\`\|query(\"" api/  # 確認無字串拼接
  ```

---

## P0 完成標準
所有 3.x 測試通過 → 翻開計劃書 v3.2，開始 P1（前端）

---

## P1  React Native 前端

- [x] **P1.1** 初始化 Expo 專案，設定 API base URL

- [x] **P1.2** 衣橱頁（WardrobeScreen）：
  - 相機/相簿選取
  - expo-image-manipulator 縮圖至 200×200 + WebP
  - K-means 非同步提取主色（最多 3 色）
  - 取色框導引 + 二次確認色票
  - 標籤選單（含 material_key / silhouette / fit_type / pattern_type 下拉）
  - 呼叫 POST /api/wardrobe

- [x] **P1.3** 推薦頁（RecommendScreen）：
  - 選擇場合（10 個，從 /meta/occasions 取得）
  - 選擇季節
  - 呼叫 POST /api/recommend
  - 顯示 3 套推薦 + 配件色建議 + 分析說明

- [x] **P1.4** 穿搭紀錄頁（OutfitRecordScreen）：
  - 記錄今日穿搭
  - 評分 1-5 星
  - 呼叫 POST /api/outfits

- [x] **P1.5** 個人設定頁（ProfileScreen）：
  - 3 題色季快速測驗（自動推薦色季）
  - 手動修改色季 / 膚色 / 體型
  - 呼叫 PATCH /api/auth/profile

---

## P2  上架準備

- [ ] **P2.1** App Store / Google Play 帳號申請

- [ ] **P2.2** 隱私政策頁面

- [ ] **P2.3** App 圖示 + 截圖製作

- [ ] **P2.4** Expo EAS Build 設定

- [ ] **P2.5** 提交審核
