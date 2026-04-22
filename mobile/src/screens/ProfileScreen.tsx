import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../api/auth';
import type { ColorSeason, SkinTone, BodyType } from '../types';

// ─── Label maps ───────────────────────────────────────────────────────────────

const COLOR_SEASON_LABELS: Record<ColorSeason, string> = {
  bright_spring: '亮春',
  true_spring:   '純春',
  light_spring:  '淡春',
  light_summer:  '淡夏',
  true_summer:   '純夏',
  soft_summer:   '柔夏',
  soft_autumn:   '柔秋',
  true_autumn:   '純秋',
  deep_autumn:   '深秋',
  deep_winter:   '深冬',
  true_winter:   '純冬',
  bright_winter: '亮冬',
};

const COLOR_SEASON_DESC: Record<ColorSeason, string> = {
  bright_spring: '鮮豔暖色，高對比',
  true_spring:   '溫暖純正，中對比',
  light_spring:  '柔和暖色，低對比',
  light_summer:  '淡雅冷色，低對比',
  true_summer:   '清爽冷色，中對比',
  soft_summer:   '霧感冷色，低對比',
  soft_autumn:   '霧感暖色，低對比',
  true_autumn:   '大地暖色，中對比',
  deep_autumn:   '深沉暖色，高對比',
  deep_winter:   '深沉冷色，高對比',
  true_winter:   '純正冷色，高對比',
  bright_winter: '鮮豔冷色，高對比',
};

const SKIN_TONE_LABELS: Record<SkinTone, string> = {
  cool_white:  '冷白',
  warm_yellow: '暖黃',
  wheat_tan:   '小麥',
  neutral:     '中性',
};

const BODY_TYPE_LABELS: Record<BodyType, string> = {
  upper_heavy: '上重型',
  pear_shape:  '梨型',
  balanced:    '均衡型',
};

const BODY_TYPE_DESC: Record<BodyType, string> = {
  upper_heavy: '肩寬或上身較豐滿',
  pear_shape:  '臀部或大腿較寬',
  balanced:    '上下比例接近',
};

// Season family accent colour
const FAMILY_COLOR: Record<string, string> = {
  spring: '#FFEAA7',
  summer: '#B2D8F5',
  autumn: '#FDCB6E',
  winter: '#C8B2F5',
};

function getFamily(cs: ColorSeason): string {
  if (cs.includes('spring')) return 'spring';
  if (cs.includes('summer')) return 'summer';
  if (cs.includes('autumn')) return 'autumn';
  return 'winter';
}

const COLOR_SEASONS: ColorSeason[] = [
  'bright_spring', 'true_spring', 'light_spring',
  'light_summer',  'true_summer', 'soft_summer',
  'soft_autumn',   'true_autumn', 'deep_autumn',
  'deep_winter',   'true_winter', 'bright_winter',
];

const SKIN_TONES:  SkinTone[]  = ['cool_white', 'warm_yellow', 'wheat_tan', 'neutral'];
const BODY_TYPES:  BodyType[]  = ['upper_heavy', 'pear_shape', 'balanced'];

const PROFILE_KEY = 'user_profile';

// ─── Quiz logic ───────────────────────────────────────────────────────────────

type QuizAnswer = { undertone: string; depth: string; clarity: string };
type QuizStep   = 1 | 2 | 3 | 'result';

const QUIZ_MAP: Record<string, ColorSeason> = {
  'cool-light-bright':    'bright_winter',
  'cool-light-soft':      'light_summer',
  'cool-light-true':      'light_summer',
  'cool-medium-bright':   'true_winter',
  'cool-medium-soft':     'soft_summer',
  'cool-medium-true':     'true_summer',
  'cool-deep-bright':     'deep_winter',
  'cool-deep-soft':       'true_winter',
  'cool-deep-true':       'true_winter',
  'warm-light-bright':    'bright_spring',
  'warm-light-soft':      'light_spring',
  'warm-light-true':      'true_spring',
  'warm-medium-bright':   'true_spring',
  'warm-medium-soft':     'soft_autumn',
  'warm-medium-true':     'true_autumn',
  'warm-deep-bright':     'deep_autumn',
  'warm-deep-soft':       'soft_autumn',
  'warm-deep-true':       'deep_autumn',
  'neutral-light-bright': 'bright_spring',
  'neutral-light-soft':   'light_summer',
  'neutral-light-true':   'light_spring',
  'neutral-medium-bright':'bright_winter',
  'neutral-medium-soft':  'soft_autumn',
  'neutral-medium-true':  'true_summer',
  'neutral-deep-bright':  'deep_winter',
  'neutral-deep-soft':    'soft_autumn',
  'neutral-deep-true':    'true_autumn',
};

function deriveColorSeason(a: QuizAnswer): ColorSeason {
  return QUIZ_MAP[`${a.undertone}-${a.depth}-${a.clarity}`] ?? 'true_summer';
}

const QUIZ_QUESTIONS = [
  {
    step:     1 as 1,
    title:    '膚色底調',
    question: '你的皮膚底色偏向哪個方向？',
    hint:     '可觀察手腕內側靜脈顏色來判斷',
    options:  [
      { key: 'cool',    label: '偏冷', sub: '靜脈偏藍紫，皮膚帶粉紅或玫瑰色調' },
      { key: 'warm',    label: '偏暖', sub: '靜脈偏綠，皮膚帶黃或金色調' },
      { key: 'neutral', label: '中性', sub: '靜脈藍綠混合，冷暖難以分辨' },
    ],
  },
  {
    step:     2 as 2,
    title:    '整體明度',
    question: '你的整體明暗程度如何？',
    hint:     '綜合考量膚色、髮色和瞳色',
    options:  [
      { key: 'light',  label: '偏淺', sub: '膚色白皙，髮色較淺（淺棕、黃棕）' },
      { key: 'deep',   label: '偏深', sub: '膚色較深，髮色深濃（深棕、黑）' },
      { key: 'medium', label: '中等', sub: '介於淺深之間，無明顯偏向' },
    ],
  },
  {
    step:     3 as 3,
    title:    '色彩清晰度',
    question: '穿哪類顏色最顯氣色？',
    hint:     '試想哪類顏色讓你的臉色更紅潤透亮',
    options:  [
      { key: 'bright', label: '鮮豔飽和', sub: '純色或高飽和色讓你更有精神' },
      { key: 'soft',   label: '柔和霧感', sub: '加灰或加白的低彩度顏色更好看' },
      { key: 'true',   label: '純正清晰', sub: '不特別偏向，純正標準的顏色最舒適' },
    ],
  },
];

// ─── Quiz Modal ───────────────────────────────────────────────────────────────

function QuizModal({
  visible, onClose, onApply,
}: {
  visible: boolean;
  onClose: () => void;
  onApply: (cs: ColorSeason) => void;
}) {
  const [step,    setStep]    = useState<QuizStep>(1);
  const [answers, setAnswers] = useState<Partial<QuizAnswer>>({});

  const reset = () => { setStep(1); setAnswers({}); };

  const handleClose = () => { reset(); onClose(); };

  const handleBack = () => {
    if (step === 2)      setStep(1);
    else if (step === 3) setStep(2);
    else if (step === 'result') setStep(3);
  };

  const handleOption = (key: string) => {
    if (step === 1) { setAnswers({ undertone: key });              setStep(2); }
    else if (step === 2) { setAnswers(a => ({ ...a, depth: key })); setStep(3); }
    else if (step === 3) { setAnswers(a => ({ ...a, clarity: key })); setStep('result'); }
  };

  const result = step === 'result'
    ? deriveColorSeason(answers as QuizAnswer)
    : null;

  const q = step !== 'result' ? QUIZ_QUESTIONS[step - 1] : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={quizS.modal} edges={['top', 'bottom']}>

        {/* Header */}
        <View style={quizS.header}>
          {step !== 1 ? (
            <TouchableOpacity onPress={handleBack}>
              <Text style={quizS.backText}>‹ 上一題</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 72 }} />}
          <Text style={quizS.headerTitle}>色季快速測驗</Text>
          <TouchableOpacity onPress={handleClose}>
            <Text style={quizS.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Progress dots */}
        {step !== 'result' && (
          <View style={quizS.progress}>
            {[1, 2, 3].map(n => (
              <View
                key={n}
                style={[quizS.dot, (step as number) >= n && quizS.dotActive]}
              />
            ))}
          </View>
        )}

        <ScrollView contentContainerStyle={quizS.body}>
          {step !== 'result' && q ? (
            <>
              <Text style={quizS.stepLabel}>第 {step} 題 / 3　{q.title}</Text>
              <Text style={quizS.question}>{q.question}</Text>
              <Text style={quizS.hint}>{q.hint}</Text>
              <View style={quizS.options}>
                {q.options.map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={quizS.option}
                    onPress={() => handleOption(opt.key)}
                  >
                    <Text style={quizS.optLabel}>{opt.label}</Text>
                    <Text style={quizS.optSub}>{opt.sub}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : result ? (
            <View style={quizS.resultWrap}>
              <Text style={quizS.resultIntro}>你的色彩季型是</Text>
              <View style={[quizS.resultBadge, { backgroundColor: FAMILY_COLOR[getFamily(result)] }]}>
                <Text style={quizS.resultSeason}>{COLOR_SEASON_LABELS[result]}</Text>
                <Text style={quizS.resultFullName}>{result}</Text>
              </View>
              <Text style={quizS.resultDesc}>{COLOR_SEASON_DESC[result]}</Text>
              <TouchableOpacity
                style={quizS.applyBtn}
                onPress={() => { onApply(result); reset(); onClose(); }}
              >
                <Text style={quizS.applyBtnText}>套用此結果並返回</Text>
              </TouchableOpacity>
              <TouchableOpacity style={quizS.retryBtn} onPress={reset}>
                <Text style={quizS.retryBtnText}>重新測驗</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const quizS = StyleSheet.create({
  modal:       { flex: 1, backgroundColor: '#F8F7FF' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  backText:    { fontSize: 15, color: '#7C3AED', width: 72 },
  closeText:   { fontSize: 18, color: '#999', width: 24, textAlign: 'center' },

  progress:  { flexDirection: 'row', gap: 8, justifyContent: 'center', paddingVertical: 16 },
  dot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DDD' },
  dotActive: { backgroundColor: '#7C3AED' },

  body:      { padding: 24, paddingBottom: 48 },

  stepLabel: { fontSize: 13, color: '#999', marginBottom: 6 },
  question:  { fontSize: 22, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  hint:      { fontSize: 13, color: '#888', marginBottom: 28, fontStyle: 'italic' },

  options: { gap: 14 },
  option:  { backgroundColor: '#fff', borderRadius: 12, padding: 18, borderWidth: 1.5, borderColor: '#E5E5E5', elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  optLabel:{ fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  optSub:  { fontSize: 13, color: '#666' },

  resultWrap:   { alignItems: 'center', paddingTop: 12 },
  resultIntro:  { fontSize: 16, color: '#666', marginBottom: 16 },
  resultBadge:  { borderRadius: 16, paddingHorizontal: 32, paddingVertical: 24, alignItems: 'center', marginBottom: 16, width: '100%' },
  resultSeason: { fontSize: 28, fontWeight: '800', color: '#1A1A1A' },
  resultFullName:{ fontSize: 13, color: '#555', marginTop: 4 },
  resultDesc:   { fontSize: 15, color: '#555', textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  applyBtn:     { backgroundColor: '#7C3AED', borderRadius: 14, paddingHorizontal: 36, paddingVertical: 14, marginBottom: 12, width: '100%', alignItems: 'center' },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  retryBtn:     { paddingVertical: 10 },
  retryBtnText: { color: '#7C3AED', fontSize: 14 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

type ProfileState = {
  color_season: ColorSeason | null;
  skin_tone:    SkinTone    | null;
  body_type:    BodyType    | null;
};

type ProfileScreenProps = { onLogout?: () => void };

export function ProfileScreen({ onLogout }: ProfileScreenProps) {
  const [profile,    setProfile]    = useState<ProfileState>({ color_season: null, skin_tone: null, body_type: null });
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [showQuiz,   setShowQuiz]   = useState(false);
  const [savedOk,    setSavedOk]    = useState(false);

  // Load from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem(PROFILE_KEY)
      .then(raw => {
        if (raw) setProfile(JSON.parse(raw));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const applyQuizResult = useCallback((cs: ColorSeason) => {
    setProfile(p => ({ ...p, color_season: cs }));
    setSavedOk(false);
  }, []);

  const save = async () => {
    const { color_season, skin_tone, body_type } = profile;
    if (!color_season && !skin_tone && !body_type) {
      Alert.alert('請選擇至少一項設定', '請選擇色彩季型、膚色底調或體型');
      return;
    }
    setSaving(true);
    try {
      // Always persist locally first so the app works offline / without auth
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      setSavedOk(true);

      // Best-effort server sync — failure is non-blocking
      authApi.updateProfile({
        ...(color_season && { color_season }),
        ...(skin_tone    && { skin_tone }),
        ...(body_type    && { body_type }),
      }).catch(() => {});
    } catch {
      Alert.alert('儲存失敗', '無法寫入本機儲存，請重試');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ActivityIndicator style={{ flex: 1 }} size="large" color="#7C3AED" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>個人設定</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* Quiz CTA */}
        <TouchableOpacity style={styles.quizCard} onPress={() => { setSavedOk(false); setShowQuiz(true); }}>
          <View style={styles.quizCardLeft}>
            <Text style={styles.quizCardTitle}>🎨 色季快速測驗</Text>
            <Text style={styles.quizCardSub}>3 題找到你的色彩季型，自動套用推薦</Text>
          </View>
          <Text style={styles.quizArrow}>›</Text>
        </TouchableOpacity>

        {/* Color season */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>色彩季型</Text>
          <Text style={styles.sectionHint}>影響推薦配色規則</Text>
          <View style={styles.seasonGrid}>
            {COLOR_SEASONS.map(cs => {
              const selected = profile.color_season === cs;
              const bg = selected ? FAMILY_COLOR[getFamily(cs)] : '#FAFAFA';
              return (
                <TouchableOpacity
                  key={cs}
                  style={[styles.seasonChip, { backgroundColor: bg }, selected && styles.seasonChipSelected]}
                  onPress={() => { setProfile(p => ({ ...p, color_season: p.color_season === cs ? null : cs })); setSavedOk(false); }}
                >
                  <Text style={[styles.seasonChipText, selected && styles.seasonChipTextSelected]}>
                    {COLOR_SEASON_LABELS[cs]}
                  </Text>
                  {selected && (
                    <Text style={styles.seasonChipDesc}>{COLOR_SEASON_DESC[cs]}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Skin tone */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>膚色底調</Text>
          <Text style={styles.sectionHint}>輔助配色建議</Text>
          <View style={styles.chipRow}>
            {SKIN_TONES.map(st => (
              <TouchableOpacity
                key={st}
                style={[styles.chip, profile.skin_tone === st && styles.chipActive]}
                onPress={() => { setProfile(p => ({ ...p, skin_tone: p.skin_tone === st ? null : st })); setSavedOk(false); }}
              >
                <Text style={[styles.chipText, profile.skin_tone === st && styles.chipTextActive]}>
                  {SKIN_TONE_LABELS[st]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Body type */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>體型</Text>
          <Text style={styles.sectionHint}>影響廓形推薦邏輯</Text>
          <View style={styles.bodyGrid}>
            {BODY_TYPES.map(bt => {
              const selected = profile.body_type === bt;
              return (
                <TouchableOpacity
                  key={bt}
                  style={[styles.bodyChip, selected && styles.bodyChipActive]}
                  onPress={() => { setProfile(p => ({ ...p, body_type: p.body_type === bt ? null : bt })); setSavedOk(false); }}
                >
                  <Text style={[styles.bodyChipText, selected && styles.bodyChipTextActive]}>
                    {BODY_TYPE_LABELS[bt]}
                  </Text>
                  <Text style={[styles.bodyChipDesc, selected && { color: '#7C3AED' }]}>
                    {BODY_TYPE_DESC[bt]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={save}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>
              {savedOk ? '✓ 已儲存' : '儲存設定'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Logout */}
        {onLogout && (
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => {
              Alert.alert('登出', '確定要登出嗎？', [
                { text: '取消', style: 'cancel' },
                {
                  text: '登出', style: 'destructive',
                  onPress: async () => {
                    await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
                    onLogout();
                  },
                },
              ]);
            }}
          >
            <Text style={styles.logoutTxt}>登出</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <QuizModal
        visible={showQuiz}
        onClose={() => setShowQuiz(false)}
        onApply={applyQuizResult}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F7FF' },

  header:       { paddingHorizontal: 16, paddingVertical: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerTitle:  { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },

  body: { padding: 16 },

  quizCard:     { backgroundColor: '#7C3AED', borderRadius: 14, padding: 18, flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  quizCardLeft: { flex: 1 },
  quizCardTitle:{ fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 4 },
  quizCardSub:  { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  quizArrow:    { fontSize: 28, color: 'rgba(255,255,255,0.7)', marginLeft: 8 },

  section:      { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12 },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 2 },
  sectionHint:  { fontSize: 12, color: '#AAA', marginBottom: 14 },

  // Color season grid (3 columns)
  seasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  seasonChip: {
    width: '30.5%', borderRadius: 10, padding: 10,
    borderWidth: 1.5, borderColor: '#EEE',
    alignItems: 'center',
  },
  seasonChipSelected: { borderColor: '#7C3AED' },
  seasonChipText:     { fontSize: 13, fontWeight: '600', color: '#555', textAlign: 'center' },
  seasonChipTextSelected: { color: '#1A1A1A' },
  seasonChipDesc:     { fontSize: 10, color: '#666', textAlign: 'center', marginTop: 4, lineHeight: 13 },

  // Skin tone
  chipRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:         { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1.5, borderColor: '#DDD', backgroundColor: '#FAFAFA' },
  chipActive:   { borderColor: '#7C3AED', backgroundColor: '#F3EEFF' },
  chipText:     { fontSize: 14, color: '#555' },
  chipTextActive: { color: '#7C3AED', fontWeight: '700' },

  // Body type
  bodyGrid:         { gap: 8 },
  bodyChip:         { borderRadius: 10, padding: 14, borderWidth: 1.5, borderColor: '#EEE', backgroundColor: '#FAFAFA' },
  bodyChipActive:   { borderColor: '#7C3AED', backgroundColor: '#F3EEFF' },
  bodyChipText:     { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 2 },
  bodyChipTextActive: { color: '#7C3AED' },
  bodyChipDesc:     { fontSize: 12, color: '#AAA' },

  saveBtn:     { backgroundColor: '#7C3AED', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  logoutBtn:   { marginTop: 24, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#ddd' },
  logoutTxt:   { color: '#999', fontSize: 15, fontWeight: '600' },
});
