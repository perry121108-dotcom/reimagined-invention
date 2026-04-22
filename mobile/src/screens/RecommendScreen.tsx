import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, FlatList, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { recommendApi } from '../api/recommend';
import { ColdStartColorGuide } from '../components/ColdStartColorGuide';
import type {
  OccasionMeta, RecommendedOutfit, RecommendResponse,
  ColdStartResponse, ColdStartColorGuide as ColdStartColorGuideType,
  ColdStartSimple, Occasion, Season,
} from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────
const SEASONS: { label: string; value: Season; emoji: string }[] = [
  { label: '春', value: 'spring', emoji: '🌸' },
  { label: '夏', value: 'summer', emoji: '☀️' },
  { label: '秋', value: 'autumn', emoji: '🍂' },
  { label: '冬', value: 'winter', emoji: '❄️' },
];

const FALLBACK_LABELS: Record<number, string> = {
  0: '完整推薦',
  1: '放寬季節',
  2: '放寬分數',
  3: '歷史記錄',
};

// ── Score bar ─────────────────────────────────────────────────────────────────
function ScoreBar({ value, max = 10, label }: { value: number; max?: number; label: string }) {
  const pct = Math.min(1, Math.max(0, value / max));
  return (
    <View style={styles.scoreRow}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <View style={styles.scoreTrack}>
        {/* Use flex ratio to avoid string-percentage width issue in Fabric new arch */}
        <View style={[styles.scoreFill, { flex: pct }]} />
        <View style={{ flex: 1 - pct }} />
      </View>
      <Text style={styles.scoreNum}>{value.toFixed(1)}</Text>
    </View>
  );
}

// ── Color chip ────────────────────────────────────────────────────────────────
function ColorChip({ hex, label }: { hex: string; label?: string }) {
  return (
    <View style={styles.colorChip}>
      <View style={[styles.colorDot, { backgroundColor: hex }]} />
      {label && <Text style={styles.colorChipLabel}>{label}</Text>}
    </View>
  );
}

// ── Outfit card ───────────────────────────────────────────────────────────────
function OutfitCard({ outfit }: { outfit: RecommendedOutfit }) {
  const [open, setOpen] = useState(false);
  const { rank, score, layers, bottom, accessories, analysis } = outfit;

  return (
    <View style={styles.card}>
      {/* Card header */}
      <View style={styles.cardHeader}>
        <View style={styles.rankBadge}>
          <Text style={styles.rankTxt}>#{rank}</Text>
        </View>
        <View style={styles.totalScoreWrap}>
          <Text style={styles.totalScoreNum}>{(score * 10).toFixed(1)}</Text>
          <Text style={styles.totalScoreUnit}>/10</Text>
        </View>
      </View>

      {/* Layers */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>上身</Text>
        {layers.map((l, i) => (
          <View key={i} style={styles.garmentRow}>
            <View style={[styles.garmentColor, { backgroundColor: l.mainColor }]} />
            <View style={styles.garmentInfo}>
              <Text style={styles.garmentName} numberOfLines={1}>
                {l.name ?? l.category}
              </Text>
              <Text style={styles.garmentMeta}>{l.material} · {l.silhouette}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.divider} />

      {/* Bottom */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>下身</Text>
        <View style={styles.garmentRow}>
          <View style={[styles.garmentColor, { backgroundColor: bottom.mainColor }]} />
          <View style={styles.garmentInfo}>
            <Text style={styles.garmentName} numberOfLines={1}>
              {bottom.name ?? '下身'}
            </Text>
            <Text style={styles.garmentMeta}>{bottom.material} · {bottom.silhouette}</Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Accessories */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>配件建議</Text>
        <View style={styles.accRow}>
          <View style={styles.accItem}>
            <ColorChip hex={accessories.hat.hex} />
            <Text style={styles.accLabel}>帽</Text>
            <Text style={styles.accTip} numberOfLines={2}>{accessories.hat.label}</Text>
          </View>
          <View style={styles.accItem}>
            <ColorChip hex={accessories.shoes.hex} />
            <Text style={styles.accLabel}>鞋</Text>
            <Text style={styles.accTip} numberOfLines={2}>{accessories.shoes.label}</Text>
          </View>
          <View style={styles.accItem}>
            <ColorChip hex={accessories.bag.hex} />
            <Text style={styles.accLabel}>包</Text>
            <Text style={styles.accTip} numberOfLines={2}>{accessories.bag.label}</Text>
          </View>
        </View>
      </View>

      {/* Analysis toggle */}
      <TouchableOpacity style={styles.analysisTog} onPress={() => setOpen(v => !v)}>
        <Text style={styles.analysisTxt}>三維分析 {open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {open && (
        <View style={styles.analysisBody}>
          {/* Color */}
          <View style={styles.analysisDim}>
            <Text style={styles.dimTitle}>🎨 色彩</Text>
            <ScoreBar value={analysis.color.score} label={analysis.color.rule} />
            <Text style={styles.dimReason}>{analysis.color.reason}</Text>
          </View>

          {/* Material */}
          <View style={styles.analysisDim}>
            <Text style={styles.dimTitle}>🧵 材質</Text>
            <ScoreBar value={analysis.material.score} label="材質" />
            {analysis.material.laws?.map((law, i) => (
              <Text key={i} style={styles.dimBullet}>· {law}</Text>
            ))}
            {analysis.material.tips?.map((tip, i) => (
              <Text key={i} style={styles.dimTip}>{tip}</Text>
            ))}
          </View>

          {/* Silhouette */}
          <View style={styles.analysisDim}>
            <Text style={styles.dimTitle}>✂️ 廓形</Text>
            <ScoreBar value={analysis.silhouette.score} label={analysis.silhouette.principle} />
            {analysis.silhouette.note ? (
              <Text style={styles.dimReason}>{analysis.silhouette.note}</Text>
            ) : null}
          </View>

          {/* Warnings */}
          {analysis.warnings?.length > 0 && (
            <View style={styles.warningBox}>
              {analysis.warnings.map((w, i) => (
                <Text key={i} style={styles.warningTxt}>⚠️ {w}</Text>
              ))}
            </View>
          )}

          {/* Trend */}
          {analysis.trend_tip ? (
            <Text style={styles.trendTip}>💡 {analysis.trend_tip}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export function RecommendScreen() {
  const [occasions, setOccasions] = useState<OccasionMeta[]>([]);
  const [loadingOcc, setLoadingOcc] = useState(true);

  const [selectedOcc, setSelectedOcc] = useState<Occasion | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<Season>('spring');

  const [recommending, setRecommending] = useState(false);
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [coldStart, setColdStart] = useState<ColdStartResponse | null>(null);

  const fetchOccasions = useCallback(async () => {
    try {
      const data = await recommendApi.getOccasions();
      setOccasions(data.occasions);
      if (data.occasions.length > 0) setSelectedOcc(data.occasions[0].occasion_key as Occasion);
    } catch {
      // Use hardcoded fallback if API unreachable
      const fallback: OccasionMeta[] = [
        { occasion_key: 'work_daily',        occasion_name: '日常上班', goal: '專業舒適' },
        { occasion_key: 'work_interview',     occasion_name: '面試',    goal: '第一印象' },
        { occasion_key: 'work_presentation',  occasion_name: '簡報',    goal: '展現自信' },
        { occasion_key: 'work_creative',      occasion_name: '創意辦公', goal: '個性展現' },
        { occasion_key: 'date_first',         occasion_name: '初次約會', goal: '留下好印象' },
        { occasion_key: 'date_casual',        occasion_name: '輕鬆約會', goal: '自然隨性' },
        { occasion_key: 'casual',             occasion_name: '日常休閒', goal: '舒適自在' },
        { occasion_key: 'outdoor',            occasion_name: '戶外活動', goal: '活動方便' },
        { occasion_key: 'party',              occasion_name: '派對',    goal: '亮眼搶鏡' },
        { occasion_key: 'sport',              occasion_name: '運動',    goal: '機能舒適' },
      ];
      setOccasions(fallback);
      setSelectedOcc('work_daily');
    } finally {
      setLoadingOcc(false);
    }
  }, []);

  useEffect(() => { fetchOccasions(); }, [fetchOccasions]);

  async function handleRecommend() {
    if (!selectedOcc) { Alert.alert('請選擇場合'); return; }

    setRecommending(true);
    setResult(null);
    setColdStart(null);

    try {
      const resp = await recommendApi.recommend({ occasion: selectedOcc, season: selectedSeason });
      if ('coldStartType' in resp && resp.coldStartType === 'COLOR_GUIDANCE') {
        setColdStart(resp as ColdStartColorGuideType);
      } else if ('error' in resp && resp.error === 'COLD_START') {
        setColdStart(resp as ColdStartSimple);
      } else {
        setResult(resp as RecommendResponse);
      }
    } catch (e: any) {
      Alert.alert('推薦失敗', e.message);
    } finally {
      setRecommending(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <Text style={styles.header}>穿搭推薦</Text>

        {/* Occasion selector */}
        <Text style={styles.sectionHead}>選擇場合</Text>
        {loadingOcc ? (
          <ActivityIndicator style={{ marginVertical: 12 }} />
        ) : (
          <View style={styles.occGrid}>
            {occasions.map(o => (
              <TouchableOpacity
                key={o.occasion_key}
                style={[styles.occBtn, selectedOcc === o.occasion_key && styles.occBtnActive]}
                onPress={() => setSelectedOcc(o.occasion_key as Occasion)}
              >
                <Text style={[styles.occName, selectedOcc === o.occasion_key && styles.occNameActive]}>
                  {o.occasion_name}
                </Text>
                {selectedOcc === o.occasion_key && (
                  <Text style={styles.occGoal}>{o.goal}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Season selector */}
        <Text style={styles.sectionHead}>選擇季節</Text>
        <View style={styles.seasonRow}>
          {SEASONS.map(s => (
            <TouchableOpacity
              key={s.value}
              style={[styles.seasonBtn, selectedSeason === s.value && styles.seasonBtnActive]}
              onPress={() => setSelectedSeason(s.value)}
            >
              <Text style={styles.seasonEmoji}>{s.emoji}</Text>
              <Text style={[styles.seasonLabel, selectedSeason === s.value && styles.seasonLabelActive]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaBtn, (recommending || !selectedOcc) && styles.ctaBtnDisabled]}
          onPress={handleRecommend}
          disabled={recommending || !selectedOcc}
        >
          {recommending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaTxt}>✨  獲取推薦</Text>
          )}
        </TouchableOpacity>

        {/* Cold start — 已設定色季 → 色彩引導；未設定 → 提示 */}
        {coldStart && 'coldStartType' in coldStart && coldStart.coldStartType === 'COLOR_GUIDANCE' ? (
          <ColdStartColorGuide guide={coldStart as ColdStartColorGuideType} />
        ) : coldStart && 'error' in coldStart ? (
          <View style={styles.coldBox}>
            <Text style={styles.coldTitle}>衣橱還是空的</Text>
            <Text style={styles.coldSub}>{(coldStart as ColdStartSimple).message}</Text>
            <Text style={styles.coldHint}>先到「衣橱」頁上傳幾件衣物，或至個人設定完成色季測驗，再來推薦吧！</Text>
          </View>
        ) : null}

        {/* Results */}
        {result && (
          <View style={styles.resultsWrap}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>
                {result.recommendations.length} 套推薦
              </Text>
              {result.fallback_level > 0 && (
                <View style={styles.fallbackBadge}>
                  <Text style={styles.fallbackTxt}>
                    {FALLBACK_LABELS[result.fallback_level] ?? `Lv${result.fallback_level}`}
                  </Text>
                </View>
              )}
            </View>

            {result.recommendations.map(outfit => (
              <OutfitCard key={outfit.rank} outfit={outfit} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { fontSize: 22, fontWeight: '700', marginBottom: 20 },

  sectionHead: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 10, marginTop: 4 },

  // Occasion grid
  occGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  occBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fafafa',
  },
  occBtnActive: { backgroundColor: '#222', borderColor: '#222' },
  occName: { fontSize: 13, color: '#555', fontWeight: '500' },
  occNameActive: { color: '#fff', fontWeight: '700' },
  occGoal: { fontSize: 10, color: '#aaa', marginTop: 2 },

  // Season row
  seasonRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  seasonBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fafafa',
  },
  seasonBtnActive: { backgroundColor: '#222', borderColor: '#222' },
  seasonEmoji: { fontSize: 20, marginBottom: 4 },
  seasonLabel: { fontSize: 13, color: '#555', fontWeight: '500' },
  seasonLabelActive: { color: '#fff', fontWeight: '700' },

  // CTA
  ctaBtn: {
    backgroundColor: '#222', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 24,
  },
  ctaBtnDisabled: { opacity: 0.5 },
  ctaTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Cold start
  coldBox: {
    backgroundColor: '#fff8f0', borderRadius: 12, padding: 20,
    borderWidth: 1, borderColor: '#ffe0c0', alignItems: 'center',
  },
  coldTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  coldSub: { fontSize: 14, color: '#555', textAlign: 'center' },
  coldHint: { fontSize: 13, color: '#888', marginTop: 10, textAlign: 'center' },

  // Results
  resultsWrap: { gap: 16 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
  fallbackBadge: { backgroundColor: '#ffa500', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  fallbackTxt: { fontSize: 11, color: '#fff', fontWeight: '600' },

  // Outfit card
  card: {
    borderRadius: 16, borderWidth: 1, borderColor: '#eee',
    overflow: 'hidden', backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14, backgroundColor: '#f8f8f8', borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  rankBadge: { backgroundColor: '#222', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4 },
  rankTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  totalScoreWrap: { flexDirection: 'row', alignItems: 'baseline' },
  totalScoreNum: { fontSize: 24, fontWeight: '800', color: '#222' },
  totalScoreUnit: { fontSize: 13, color: '#888', marginLeft: 2 },

  section: { padding: 14, paddingBottom: 8 },
  sectionTitle: { fontSize: 11, fontWeight: '600', color: '#999', marginBottom: 8, textTransform: 'uppercase' },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginHorizontal: 14 },

  garmentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  garmentColor: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#eee', marginRight: 10 },
  garmentInfo: { flex: 1 },
  garmentName: { fontSize: 14, fontWeight: '600', color: '#222' },
  garmentMeta: { fontSize: 12, color: '#999', marginTop: 1 },

  accRow: { flexDirection: 'row', gap: 8 },
  accItem: { flex: 1, alignItems: 'center' },
  accLabel: { fontSize: 11, fontWeight: '700', color: '#444', marginTop: 4 },
  accTip: { fontSize: 10, color: '#888', textAlign: 'center', marginTop: 2 },
  colorChip: { alignItems: 'center' },
  colorDot: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: '#eee' },
  colorChipLabel: { fontSize: 10, marginTop: 3, color: '#666' },

  // Analysis
  analysisTog: {
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
    padding: 12, alignItems: 'center',
  },
  analysisTxt: { fontSize: 13, color: '#666', fontWeight: '600' },
  analysisBody: { padding: 14, paddingTop: 0, gap: 14 },
  analysisDim: { backgroundColor: '#fafafa', borderRadius: 10, padding: 12 },
  dimTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  dimReason: { fontSize: 12, color: '#555', marginTop: 6 },
  dimBullet: { fontSize: 12, color: '#444', marginTop: 4 },
  dimTip: { fontSize: 11, color: '#888', marginTop: 3, fontStyle: 'italic' },
  warningBox: { backgroundColor: '#fff5f0', borderRadius: 8, padding: 10 },
  warningTxt: { fontSize: 12, color: '#c0392b', marginBottom: 4 },
  trendTip: { fontSize: 12, color: '#666', fontStyle: 'italic', paddingHorizontal: 4 },

  // Score bar
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  scoreLabel: { fontSize: 12, color: '#666', width: 70 },
  scoreTrack: { flex: 1, height: 6, backgroundColor: '#e0e0e0', borderRadius: 3, overflow: 'hidden' },
  scoreFill: { height: 6, backgroundColor: '#333', borderRadius: 3 },
  scoreNum: { fontSize: 12, fontWeight: '700', color: '#333', width: 28, textAlign: 'right' },
});
