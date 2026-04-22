import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { outfitsApi, type OutfitRecord, type PostOutfitPayload } from '../api/outfits';
import { wardrobeApi } from '../api/wardrobe';
import type { ClothingItem, Occasion, Season } from '../types';

// ─── Constants ───────────────────────────────────────────────────────────────

const OCCASION_LABELS: Record<Occasion, string> = {
  work_interview:   '面試',
  work_presentation:'簡報',
  work_creative:    '創意工作',
  work_daily:       '日常上班',
  date_first:       '初次約會',
  date_casual:      '休閒約會',
  casual:           '日常休閒',
  outdoor:          '戶外活動',
  party:            '派對',
  sport:            '運動',
};

const SEASON_LABELS: Record<Season, string> = {
  spring: '🌸 春',
  summer: '☀️ 夏',
  autumn: '🍂 秋',
  winter: '❄️ 冬',
};

const RATING_LABELS = ['', '不滿意', '普通', '還不錯', '很滿意', '完美！'];
const OCCASIONS = Object.keys(OCCASION_LABELS) as Occasion[];
const SEASONS   = Object.keys(SEASON_LABELS)   as Season[];

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={starStyles.row}>
      {[1, 2, 3, 4, 5].map(s => (
        <TouchableOpacity key={s} onPress={() => onChange(s)} hitSlop={10}>
          <Text style={[starStyles.star, { color: s <= value ? '#FFD700' : '#DDD' }]}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const starStyles = StyleSheet.create({
  row:  { flexDirection: 'row', gap: 8 },
  star: { fontSize: 34 },
});

function RecordCard({ record }: { record: OutfitRecord }) {
  const score = record.user_score ?? 0;
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.topRow}>
        <Text style={cardStyles.date}>{record.worn_date}</Text>
        <Text style={cardStyles.stars}>
          {'★'.repeat(score)}{'☆'.repeat(5 - score)}
        </Text>
      </View>
      <View style={cardStyles.badges}>
        {record.occasion && (
          <View style={cardStyles.badge}>
            <Text style={cardStyles.badgeText}>
              {OCCASION_LABELS[record.occasion] ?? record.occasion}
            </Text>
          </View>
        )}
        {record.season && (
          <View style={[cardStyles.badge, { backgroundColor: '#EEF4FF' }]}>
            <Text style={cardStyles.badgeText}>
              {SEASON_LABELS[record.season] ?? record.season}
            </Text>
          </View>
        )}
        {score > 0 && (
          <View style={[cardStyles.badge, { backgroundColor: '#FFFAE6' }]}>
            <Text style={cardStyles.badgeText}>{RATING_LABELS[score]}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card:     { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginHorizontal: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  topRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  date:     { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  stars:    { fontSize: 16, color: '#FFD700', letterSpacing: 2 },
  badges:   { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge:    { backgroundColor: '#F3EEFF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:{ fontSize: 12, color: '#555' },
});

// ─── Wardrobe item row ────────────────────────────────────────────────────────

function ItemRow({
  item, selected, onPress, meta,
}: {
  item: ClothingItem; selected: boolean; onPress: () => void; meta: string;
}) {
  const mainHex = item.colors?.[0]?.hex ?? '#808080';
  return (
    <TouchableOpacity
      style={[styles.itemRow, selected && styles.itemRowSelected]}
      onPress={onPress}
    >
      <View style={[styles.colorDot, { backgroundColor: mainHex }]} />
      <Text style={styles.itemName} numberOfLines={1}>
        {item.name ?? `#${item.id} ${item.category}`}
      </Text>
      <Text style={styles.itemMeta}>{meta}</Text>
      {selected && <Text style={styles.checkMark}>✓</Text>}
    </TouchableOpacity>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

type FormState = {
  worn_date:  string;
  occasion:   Occasion | null;
  season:     Season   | null;
  user_score: number;
  layer_ids:  number[];
  bottom_id:  number | null;
};

function freshForm(): FormState {
  return { worn_date: todayStr(), occasion: null, season: null, user_score: 0, layer_ids: [], bottom_id: null };
}

export function OutfitRecordScreen() {
  const [records,        setRecords]        = useState<OutfitRecord[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [showModal,      setShowModal]      = useState(false);
  const [submitting,     setSubmitting]     = useState(false);
  const [wardrobe,       setWardrobe]       = useState<ClothingItem[]>([]);
  const [wardrobeLoading,setWardrobeLoading]= useState(false);
  const [form,           setForm]           = useState<FormState>(freshForm);

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      const res = await outfitsApi.list();
      setRecords(res.records);
    } catch {
      Alert.alert('載入失敗', '無法取得穿搭紀錄，請確認網路連線');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const openModal = async () => {
    setForm(freshForm());
    setShowModal(true);
    setWardrobeLoading(true);
    try {
      const res = await wardrobeApi.list();
      setWardrobe(res.items);
    } catch {
      setWardrobe([]);
    } finally {
      setWardrobeLoading(false);
    }
  };

  const submit = async () => {
    if (form.user_score === 0) {
      Alert.alert('請給評分', '請為今日穿搭評分（1–5 星）');
      return;
    }
    setSubmitting(true);
    try {
      const payload: PostOutfitPayload = {
        worn_date:    form.worn_date,
        user_score:   form.user_score,
        is_ai_suggested: false,
        ...(form.occasion                && { occasion:   form.occasion }),
        ...(form.season                  && { season:     form.season }),
        ...(form.layer_ids.length > 0    && { layer_ids:  form.layer_ids }),
        ...(form.bottom_id !== null      && { bottom_id:  form.bottom_id }),
      };
      await outfitsApi.add(payload);
      setShowModal(false);
      loadRecords();
    } catch (e: any) {
      Alert.alert('儲存失敗', e.message ?? '請稍後再試');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleLayer = (id: number) =>
    setForm(f => ({
      ...f,
      layer_ids: f.layer_ids.includes(id)
        ? f.layer_ids.filter(x => x !== id)
        : [...f.layer_ids, id],
    }));

  const tops    = wardrobe.filter(i => ['inner_top','top','outer'].includes(i.category));
  const bottoms = wardrobe.filter(i => i.category === 'bottom');

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>穿搭紀錄</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openModal}>
          <Text style={styles.addBtnText}>+ 記錄今日</Text>
        </TouchableOpacity>
      </View>

      {/* ── Record list ── */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color="#7C3AED" />
      ) : records.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={styles.emptyTitle}>還沒有穿搭紀錄</Text>
          <Text style={styles.emptySub}>點擊右上角「+ 記錄今日」開始記錄</Text>
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={r => String(r.id)}
          renderItem={({ item }) => <RecordCard record={item} />}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 40 }}
        />
      )}

      {/* ── Add Modal ── */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>

          {/* Modal header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={styles.cancelText}>取消</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>記錄今日穿搭</Text>
            <TouchableOpacity onPress={submit} disabled={submitting}>
              <Text style={[styles.saveText, submitting && { opacity: 0.4 }]}>儲存</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>

            {/* Date */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>日期</Text>
              <View style={styles.dateBox}>
                <Text style={styles.dateText}>{form.worn_date}</Text>
              </View>
            </View>

            {/* Star rating */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>今日穿搭評分 *</Text>
              <StarRating
                value={form.user_score}
                onChange={v => setForm(f => ({ ...f, user_score: v }))}
              />
              {form.user_score > 0 && (
                <Text style={styles.ratingHint}>{RATING_LABELS[form.user_score]}</Text>
              )}
            </View>

            {/* Occasion */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>場合（選填）</Text>
              <View style={styles.chipGrid}>
                {OCCASIONS.map(occ => (
                  <TouchableOpacity
                    key={occ}
                    style={[styles.chip, form.occasion === occ && styles.chipActive]}
                    onPress={() => setForm(f => ({ ...f, occasion: f.occasion === occ ? null : occ }))}
                  >
                    <Text style={[styles.chipText, form.occasion === occ && styles.chipTextActive]}>
                      {OCCASION_LABELS[occ]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Season */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>季節（選填）</Text>
              <View style={styles.chipRow}>
                {SEASONS.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, form.season === s && styles.chipActive]}
                    onPress={() => setForm(f => ({ ...f, season: f.season === s ? null : s }))}
                  >
                    <Text style={[styles.chipText, form.season === s && styles.chipTextActive]}>
                      {SEASON_LABELS[s]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Tops / Layers */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>上衣 / 外套（可多選）</Text>
              {wardrobeLoading ? (
                <ActivityIndicator color="#7C3AED" />
              ) : tops.length === 0 ? (
                <Text style={styles.noItemsNote}>尚無上衣，請先在衣橱頁新增</Text>
              ) : (
                tops.map(item => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    selected={form.layer_ids.includes(item.id)}
                    meta={item.material_key}
                    onPress={() => toggleLayer(item.id)}
                  />
                ))
              )}
            </View>

            {/* Bottom */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>下身（單選）</Text>
              {wardrobeLoading ? (
                <ActivityIndicator color="#7C3AED" />
              ) : bottoms.length === 0 ? (
                <Text style={styles.noItemsNote}>尚無下身單品，請先在衣橱頁新增</Text>
              ) : (
                bottoms.map(item => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    selected={form.bottom_id === item.id}
                    meta={item.silhouette}
                    onPress={() =>
                      setForm(f => ({ ...f, bottom_id: f.bottom_id === item.id ? null : item.id }))
                    }
                  />
                ))
              )}
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F7FF' },

  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerTitle:  { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  addBtn:       { backgroundColor: '#7C3AED', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText:   { color: '#fff', fontWeight: '600', fontSize: 14 },

  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIcon:  { fontSize: 52, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  emptySub:   { fontSize: 14, color: '#999', textAlign: 'center', paddingHorizontal: 40 },

  modal:       { flex: 1, backgroundColor: '#F8F7FF' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  modalTitle:  { fontSize: 17, fontWeight: '700' },
  cancelText:  { fontSize: 16, color: '#888' },
  saveText:    { fontSize: 16, fontWeight: '700', color: '#7C3AED' },

  modalBody: { padding: 16 },

  section:      { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 12 },

  dateBox:   { backgroundColor: '#F3EEFF', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-start' },
  dateText:  { fontSize: 18, fontWeight: '700', color: '#7C3AED' },

  ratingHint: { marginTop: 10, fontSize: 14, color: '#7C3AED', fontWeight: '600' },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipRow:  { flexDirection: 'row', gap: 8 },
  chip:          { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1.5, borderColor: '#DDD', backgroundColor: '#FAFAFA' },
  chipActive:    { borderColor: '#7C3AED', backgroundColor: '#F3EEFF' },
  chipText:      { fontSize: 13, color: '#555' },
  chipTextActive:{ color: '#7C3AED', fontWeight: '600' },

  itemRow:         { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#EEE', marginBottom: 8, backgroundColor: '#FAFAFA' },
  itemRowSelected: { borderColor: '#7C3AED', backgroundColor: '#F3EEFF' },
  colorDot:  { width: 22, height: 22, borderRadius: 11, marginRight: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  itemName:  { flex: 1, fontSize: 14, color: '#333' },
  itemMeta:  { fontSize: 12, color: '#999', marginRight: 6 },
  checkMark: { fontSize: 16, color: '#7C3AED', fontWeight: '700' },

  noItemsNote: { fontSize: 13, color: '#AAA', fontStyle: 'italic' },
});
