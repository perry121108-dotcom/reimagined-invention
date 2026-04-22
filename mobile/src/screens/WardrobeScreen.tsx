import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, FlatList, Image, Modal,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity,
  View, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { extractColors, processForStorage } from '../utils/colorExtractor';
import { ColorConfirmSheet } from '../components/ColorConfirmSheet';
import { TagPicker } from '../components/TagPicker';
import { wardrobeApi, type AddItemPayload } from '../api/wardrobe';
import type { ClothingItem, ColorEntry, Category, MaterialKey, Silhouette, FitType, PatternType, DrapeLevel } from '../types';

// ── Option lists ──────────────────────────────────────────────────────────────
const CATEGORY_OPTS = [
  { label: '內搭上衣', value: 'inner_top' as Category },
  { label: '上衣', value: 'top' as Category },
  { label: '外套', value: 'outer' as Category },
  { label: '下身', value: 'bottom' as Category },
  { label: '配件', value: 'accessory' as Category },
];

const SILHOUETTE_TOP_OPTS: { label: string; value: Silhouette }[] = [
  { label: '寬鬆 oversized', value: 'oversized' },
  { label: '正常 regular', value: 'regular' },
  { label: '修身 slim', value: 'slim' },
  { label: '短版 cropped', value: 'cropped' },
  { label: '蓬腰 peplum', value: 'peplum' },
  { label: '繞頸 wrap', value: 'wrap' },
  { label: '露肩 off_shoulder', value: 'off_shoulder' },
];
const SILHOUETTE_BOT_OPTS: { label: string; value: Silhouette }[] = [
  { label: '闊腿 wide_leg', value: 'wide_leg' },
  { label: '直筒 straight', value: 'straight' },
  { label: '窄管 slim_fit', value: 'slim_fit' },
  { label: 'A字 a_line', value: 'a_line' },
  { label: '鉛筆 pencil', value: 'pencil' },
  { label: '迷你 mini', value: 'mini' },
  { label: '長裙 maxi', value: 'maxi' },
];

const MATERIAL_OPTS: { label: string; value: MaterialKey }[] = [
  { label: '絲緞', value: 'silk_satin' }, { label: '絲縐', value: 'silk_crepe' },
  { label: '絲喬其', value: 'silk_georgette' }, { label: '細羊毛', value: 'wool_fine' },
  { label: '粗羊毛', value: 'wool_coarse' }, { label: '喀什米爾', value: 'cashmere' },
  { label: '棉', value: 'cotton' }, { label: '亞麻', value: 'linen' },
  { label: '棉麻', value: 'cotton_linen' }, { label: '啞光皮革', value: 'leather_matte' },
  { label: '亮面皮革', value: 'leather_patent' }, { label: '粗針織', value: 'knit_chunky' },
  { label: '細針織', value: 'knit_fine' }, { label: '醋酸纖維', value: 'acetate' },
  { label: '聚酯纖維', value: 'polyester' }, { label: '尼龍', value: 'nylon' },
  { label: '天鵝絨', value: 'velvet' }, { label: '丹寧', value: 'denim' },
  { label: '雪紡', value: 'chiffon' }, { label: '歐根紗', value: 'organza' },
];

const FIT_OPTS: { label: string; value: FitType }[] = [
  { label: '寬鬆 oversized', value: 'oversized' },
  { label: '修身 slim', value: 'slim' },
  { label: '正常 regular', value: 'regular' },
  { label: '短版 cropped', value: 'cropped' },
];

const PATTERN_OPTS: { label: string; value: PatternType }[] = [
  { label: '素色', value: 'solid' }, { label: '條紋', value: 'stripe' },
  { label: '格紋', value: 'check' }, { label: '圓點', value: 'dot' },
  { label: '花卉', value: 'floral' }, { label: '幾何', value: 'geometric' },
  { label: '抽象', value: 'abstract' }, { label: '混合印花', value: 'print_multi' },
];

const DRAPE_OPTS: { label: string; value: DrapeLevel }[] = [
  { label: '高垂墜', value: 'high' }, { label: '中垂墜', value: 'medium' },
  { label: '低垂墜', value: 'low' }, { label: '無垂墜', value: 'none' },
];

const SEASON_OPTS = ['spring', 'summer', 'autumn', 'winter'] as const;
const SEASON_LABEL: Record<string, string> = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };

const STYLE_OPTS = ['casual', 'work', 'formal', 'date', 'sport', 'outdoor', 'all'] as const;
const STYLE_LABEL: Record<string, string> = {
  casual: '休閒', work: '上班', formal: '正式', date: '約會', sport: '運動', outdoor: '戶外', all: '全場合',
};

const FILTER_TABS = [
  { label: '全部', value: 'all' },
  { label: '上衣', value: 'top' },
  { label: '外套', value: 'outer' },
  { label: '下身', value: 'bottom' },
  { label: '配件', value: 'accessory' },
];

// ── Types ─────────────────────────────────────────────────────────────────────
type AddStep = 'source' | 'extract' | 'confirm' | 'meta';

type FormState = {
  name: string;
  category: Category;
  fit_type: FitType;
  silhouette: Silhouette;
  material_key: MaterialKey;
  pattern_type: PatternType;
  drape_level: DrapeLevel;
  season_tags: string[];
  style_tags: string[];
};

// ── Component ─────────────────────────────────────────────────────────────────
export function WardrobeScreen() {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const [modalVisible, setModalVisible] = useState(false);
  const [step, setStep] = useState<AddStep>('source');
  const [rawUri, setRawUri] = useState<string | null>(null);
  const [storedUri, setStoredUri] = useState<string | null>(null);
  const [colors, setColors] = useState<ColorEntry[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;

  const [form, setForm] = useState<FormState>({
    name: '',
    category: 'top',
    fit_type: 'regular',
    silhouette: 'regular',
    material_key: 'cotton',
    pattern_type: 'solid',
    drape_level: 'medium',
    season_tags: [],
    style_tags: [],
  });

  // Derived: silhouette options depend on category
  const silhouetteOpts =
    form.category === 'bottom' ? SILHOUETTE_BOT_OPTS : SILHOUETTE_TOP_OPTS;

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? { category: filter } : undefined;
      const data = await wardrobeApi.list(params);
      setItems(data.items);
    } catch (e: any) {
      Alert.alert('載入失敗', e.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function openModal() {
    setStep('source');
    setRawUri(null);
    setStoredUri(null);
    setColors([]);
    setForm({
      name: '', category: 'top', fit_type: 'regular', silhouette: 'regular',
      material_key: 'cotton', pattern_type: 'solid', drape_level: 'medium',
      season_tags: [], style_tags: [],
    });
    setModalVisible(true);
    Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 60 }).start();
  }

  function closeModal() {
    Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
      setModalVisible(false),
    );
  }

  async function pickImage(source: 'camera' | 'gallery') {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { Alert.alert('需要相機權限'); return; }
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.9 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.9 });

    if (result.canceled || !result.assets[0]?.uri) return;

    const uri = result.assets[0].uri;
    setRawUri(uri);
    setStep('extract');
    setExtracting(true);

    try {
      const [stored, extracted] = await Promise.all([
        processForStorage(uri),
        extractColors(uri),
      ]);
      setStoredUri(stored);
      setColors(extracted);
      setStep('confirm');
    } catch (e: any) {
      Alert.alert('取色失敗', e.message);
      setStep('source');
    } finally {
      setExtracting(false);
    }
  }

  async function submitItem() {
    if (!colors.length) { Alert.alert('請先選取圖片'); return; }

    // layer_order: inner_top=1, top=2, outer=3, bottom/accessory=null
    const layerMap: Partial<Record<Category, number>> = { inner_top: 1, top: 2, outer: 3 };
    const layer_order = layerMap[form.category] ?? null;

    const payload: AddItemPayload = {
      image_url: storedUri ?? undefined,
      name: form.name || undefined,
      category: form.category,
      layer_order,
      colors,
      fit_type: form.fit_type,
      silhouette: form.silhouette,
      material_key: form.material_key,
      pattern_type: form.pattern_type,
      drape_level: form.drape_level,
      season_tags: form.season_tags,
      style_tags: form.style_tags,
    };

    try {
      setSubmitting(true);
      await wardrobeApi.add(payload);
      closeModal();
      fetchItems();
    } catch (e: any) {
      Alert.alert('新增失敗', e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function toggleChip(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter(v => v !== value) : [...list, value];
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  function renderCard({ item }: { item: ClothingItem }) {
    const mainColor = item.colors?.[0]?.hex ?? '#ccc';
    return (
      <TouchableOpacity style={styles.card}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.cardImg} />
        ) : (
          <View style={[styles.cardImg, { backgroundColor: mainColor }]} />
        )}
        <View style={styles.cardDots}>
          {(item.colors ?? []).slice(0, 3).map((c, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: c.hex }]} />
          ))}
        </View>
        <Text style={styles.cardLabel} numberOfLines={1}>
          {item.name ?? CATEGORY_OPTS.find(o => o.value === item.category)?.label ?? item.category}
        </Text>
      </TouchableOpacity>
    );
  }

  function renderModalContent() {
    if (step === 'source') {
      return (
        <View style={styles.stepWrap}>
          <Text style={styles.stepTitle}>新增衣物</Text>
          <TouchableOpacity style={styles.sourceBtn} onPress={() => pickImage('camera')}>
            <Text style={styles.sourceBtnTxt}>📷  拍照</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.sourceBtn, { marginTop: 12 }]} onPress={() => pickImage('gallery')}>
            <Text style={styles.sourceBtnTxt}>🖼️  從相簿選取</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
            <Text style={styles.cancelBtnTxt}>取消</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (step === 'extract') {
      return (
        <View style={[styles.stepWrap, styles.center]}>
          <ActivityIndicator size="large" color="#333" />
          <Text style={styles.extractingTxt}>K-means 提取主色中…</Text>
        </View>
      );
    }

    if (step === 'confirm' && rawUri) {
      return (
        <ColorConfirmSheet
          imageUri={rawUri}
          colors={colors}
          onConfirm={confirmed => { setColors(confirmed); setStep('meta'); }}
          onBack={() => setStep('source')}
        />
      );
    }

    if (step === 'meta') {
      return (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView style={styles.metaScroll} contentContainerStyle={styles.metaContent}>
            <Text style={styles.stepTitle}>衣物資訊</Text>

            {/* Color preview */}
            <View style={styles.colorPreviewRow}>
              {colors.map((c, i) => (
                <View key={i} style={[styles.colorPreview, { backgroundColor: c.hex }]} />
              ))}
            </View>

            {/* Name */}
            <Text style={styles.metaLabel}>名稱（選填）</Text>
            <TextInput
              style={styles.textInput}
              value={form.name}
              onChangeText={v => setForm(f => ({ ...f, name: v }))}
              placeholder="例：米白素縐緞襯衫"
            />

            {/* Category */}
            <TagPicker
              label="類別 *"
              value={form.category}
              options={CATEGORY_OPTS}
              onChange={v => setForm(f => ({ ...f, category: v, silhouette: 'regular' as Silhouette }))}
            />

            {/* Material */}
            <TagPicker
              label="材質"
              value={form.material_key}
              options={MATERIAL_OPTS}
              onChange={v => setForm(f => ({ ...f, material_key: v }))}
            />

            {/* Silhouette */}
            {form.category !== 'accessory' && (
              <TagPicker
                label="廓形"
                value={form.silhouette}
                options={silhouetteOpts}
                onChange={v => setForm(f => ({ ...f, silhouette: v }))}
              />
            )}

            {/* Fit Type */}
            {form.category !== 'accessory' && (
              <TagPicker
                label="版型"
                value={form.fit_type}
                options={FIT_OPTS}
                onChange={v => setForm(f => ({ ...f, fit_type: v }))}
              />
            )}

            {/* Pattern */}
            <TagPicker
              label="花紋"
              value={form.pattern_type}
              options={PATTERN_OPTS}
              onChange={v => setForm(f => ({ ...f, pattern_type: v }))}
            />

            {/* Drape */}
            <TagPicker
              label="垂墜感"
              value={form.drape_level}
              options={DRAPE_OPTS}
              onChange={v => setForm(f => ({ ...f, drape_level: v }))}
            />

            {/* Season tags */}
            <Text style={styles.metaLabel}>適合季節</Text>
            <View style={styles.chipRow}>
              {SEASON_OPTS.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, form.season_tags.includes(s) && styles.chipActive]}
                  onPress={() => setForm(f => ({ ...f, season_tags: toggleChip(f.season_tags, s) }))}
                >
                  <Text style={[styles.chipTxt, form.season_tags.includes(s) && styles.chipTxtActive]}>
                    {SEASON_LABEL[s]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Style tags */}
            <Text style={styles.metaLabel}>風格標籤</Text>
            <View style={styles.chipRow}>
              {STYLE_OPTS.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, form.style_tags.includes(s) && styles.chipActive]}
                  onPress={() => setForm(f => ({ ...f, style_tags: toggleChip(f.style_tags, s) }))}
                >
                  <Text style={[styles.chipTxt, form.style_tags.includes(s) && styles.chipTxtActive]}>
                    {STYLE_LABEL[s]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Buttons */}
            <View style={styles.metaBtnRow}>
              <TouchableOpacity style={styles.btnBack} onPress={() => setStep('confirm')}>
                <Text style={styles.btnBackTxt}>← 修改顏色</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnConfirm, submitting && { opacity: 0.6 }]}
                onPress={submitItem}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnConfirmTxt}>儲存衣物</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      );
    }

    return null;
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  const filtered = filter === 'all' ? items : items.filter(i => i.category === filter);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>我的衣橱</Text>
        <Text style={styles.headerCount}>{items.length} 件</Text>
      </View>

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        {FILTER_TABS.map(t => (
          <TouchableOpacity
            key={t.value}
            style={[styles.tab, filter === t.value && styles.tabActive]}
            onPress={() => setFilter(t.value)}
          >
            <Text style={[styles.tabTxt, filter === t.value && styles.tabTxtActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Grid */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#333" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTxt}>衣橱是空的，點擊 + 新增第一件衣物</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          numColumns={2}
          renderItem={renderCard}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          onRefresh={fetchItems}
          refreshing={loading}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openModal}>
        <Text style={styles.fabTxt}>＋</Text>
      </TouchableOpacity>

      {/* Add Item Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
          {renderModalContent()}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { fontSize: 22, fontWeight: '700' },
  headerCount: { fontSize: 14, color: '#888' },
  tabScroll: { paddingHorizontal: 16, marginBottom: 4 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: '#f2f2f2' },
  tabActive: { backgroundColor: '#333' },
  tabTxt: { fontSize: 13, color: '#555' },
  tabTxtActive: { color: '#fff', fontWeight: '600' },
  grid: { padding: 12 },
  gridRow: { gap: 10 },
  card: {
    flex: 1, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#f8f8f8', marginBottom: 10, borderWidth: 1, borderColor: '#eee',
  },
  cardImg: { width: '100%', aspectRatio: 1 },
  cardDots: { flexDirection: 'row', padding: 6, gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: '#fff' },
  cardLabel: { fontSize: 11, color: '#555', paddingHorizontal: 8, paddingBottom: 8 },
  fab: {
    position: 'absolute', right: 20, bottom: 30,
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#222',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8,
  },
  fabTxt: { color: '#fff', fontSize: 28, lineHeight: 30 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTxt: { color: '#aaa', fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  modalSafe: { flex: 1, backgroundColor: '#fff' },

  // Steps
  stepWrap: { flex: 1, padding: 24 },
  stepTitle: { fontSize: 20, fontWeight: '700', marginBottom: 24, textAlign: 'center' },
  sourceBtn: { backgroundColor: '#222', borderRadius: 12, padding: 18, alignItems: 'center' },
  sourceBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelBtn: { marginTop: 20, alignItems: 'center' },
  cancelBtnTxt: { color: '#888', fontSize: 15 },
  extractingTxt: { marginTop: 16, color: '#555', fontSize: 15 },

  // Meta form
  metaScroll: { flex: 1 },
  metaContent: { padding: 20 },
  metaLabel: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 4 },
  textInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 15, marginBottom: 12 },
  colorPreviewRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  colorPreview: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#eee' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fafafa' },
  chipActive: { backgroundColor: '#333', borderColor: '#333' },
  chipTxt: { fontSize: 13, color: '#555' },
  chipTxtActive: { color: '#fff', fontWeight: '600' },
  metaBtnRow: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 32 },
  btnBack: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  btnBackTxt: { color: '#555', fontWeight: '600' },
  btnConfirm: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#333', alignItems: 'center' },
  btnConfirmTxt: { color: '#fff', fontWeight: '700' },
});
