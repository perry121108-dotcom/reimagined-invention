import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ColdStartColorGuide as ColdStartColorGuideType } from '../types';

type Props = { guide: ColdStartColorGuideType };

const SLOT_ICONS: Record<string, string> = {
  outerwear: '🧥',
  top:       '👕',
  bottom:    '👖',
  accent:    '👜',
};

const SLOT_NAMES: Record<string, string> = {
  outerwear: '外套',
  top:       '上衣',
  bottom:    '下身',
  accent:    '配件',
};

function ColorSwatch({ slotKey, item }: { slotKey: string; item: { color: string; label: string } }) {
  function onPress() {
    Alert.alert(
      `${SLOT_ICONS[slotKey]} ${SLOT_NAMES[slotKey]}`,
      `${item.label}\n色碼：${item.color}\n\n長按色碼文字可複製`,
    );
  }

  return (
    <TouchableOpacity style={styles.swatchCard} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.swatchBlock, { backgroundColor: item.color }]} />
      <View style={styles.swatchInfo}>
        <Text style={styles.swatchSlot}>{SLOT_ICONS[slotKey]} {SLOT_NAMES[slotKey]}</Text>
        <Text style={styles.swatchLabel} numberOfLines={1}>{item.label}</Text>
        <Text style={styles.swatchHex} selectable>{item.color}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function ColdStartColorGuide({ guide }: Props) {
  const { colorSeasonLabel, suggestedOutfitStructure, silhouetteSuggestion, reasoning, shoppingGuide } = guide;
  const { outerwear, top, bottom, accent } = suggestedOutfitStructure;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>🎨</Text>
        <View style={styles.headerText}>
          <Text style={styles.title}>冷啟動色彩引導</Text>
          <Text style={styles.subtitle}>色季：{colorSeasonLabel}</Text>
        </View>
      </View>

      {/* Color swatches */}
      <Text style={styles.sectionLabel}>推薦購買顏色</Text>
      <View style={styles.swatchGrid}>
        <ColorSwatch slotKey="outerwear" item={outerwear} />
        <ColorSwatch slotKey="top"       item={top} />
        <ColorSwatch slotKey="bottom"    item={bottom} />
        <ColorSwatch slotKey="accent"    item={accent} />
      </View>

      {/* Silhouette suggestion */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>💡 廓形建議</Text>
        <View style={styles.silhouetteBox}>
          <Text style={styles.silhouetteRow}>
            <Text style={styles.silhouetteKey}>上衣：</Text>
            {silhouetteSuggestion.top}
          </Text>
          <Text style={[styles.silhouetteRow, { marginTop: 6 }]}>
            <Text style={styles.silhouetteKey}>下身：</Text>
            {silhouetteSuggestion.bottom}
          </Text>
          <Text style={styles.silhouetteTip}>{silhouetteSuggestion.tip}</Text>
        </View>
      </View>

      {/* Reasoning */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>📝 分析說明</Text>
        <Text style={styles.reasoningText}>{reasoning}</Text>
      </View>

      {/* Shopping guide */}
      <View style={styles.guideBox}>
        <Text style={styles.guideText}>🛍 {shoppingGuide}</Text>
      </View>

      <Text style={styles.hint}>點擊色塊可查看色碼；長按色碼文字可複製</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0e8ff',
    overflow: 'hidden',
    shadowColor: '#6B4EFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f0ff',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ece4ff',
  },
  headerIcon: { fontSize: 28 },
  headerText: { flex: 1 },
  title:    { fontSize: 16, fontWeight: '700', color: '#2D1B69' },
  subtitle: { fontSize: 13, color: '#7C5CBF', marginTop: 2 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  swatchGrid: { paddingHorizontal: 12, paddingBottom: 4, gap: 8 },
  swatchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden',
    backgroundColor: '#fafafa',
  },
  swatchBlock: { width: 64, height: 64 },
  swatchInfo: { flex: 1, paddingHorizontal: 14, gap: 2 },
  swatchSlot:  { fontSize: 13, fontWeight: '700', color: '#222' },
  swatchLabel: { fontSize: 12, color: '#555' },
  swatchHex:   { fontSize: 11, color: '#888', fontFamily: 'monospace' },

  section: { paddingHorizontal: 16 },
  silhouetteBox: {
    backgroundColor: '#f8f8ff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 4,
  },
  silhouetteRow: { fontSize: 13, color: '#333', lineHeight: 20 },
  silhouetteKey: { fontWeight: '700', color: '#444' },
  silhouetteTip: { fontSize: 12, color: '#888', marginTop: 8, fontStyle: 'italic' },

  reasoningText: {
    fontSize: 13,
    color: '#555',
    lineHeight: 20,
    backgroundColor: '#fafafa',
    borderRadius: 10,
    padding: 12,
    marginBottom: 4,
  },

  guideBox: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#fff8e8',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ffe0a0',
  },
  guideText: { fontSize: 13, color: '#8B5E00', lineHeight: 20 },

  hint: {
    fontSize: 11,
    color: '#aaa',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
