import React, { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, TextInput,
  StyleSheet, Modal, Alert,
} from 'react-native';
import type { ColorEntry } from '../types';

type Props = {
  imageUri: string;
  colors: ColorEntry[];
  onConfirm: (colors: ColorEntry[]) => void;
  onBack: () => void;
};

export function ColorConfirmSheet({ imageUri, colors, onConfirm, onBack }: Props) {
  const [draft, setDraft] = useState<ColorEntry[]>(colors.map(c => ({ ...c })));
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [hexInput, setHexInput] = useState('');

  function openEdit(idx: number) {
    setEditIdx(idx);
    setHexInput(draft[idx].hex);
  }

  function applyHex() {
    if (editIdx === null) return;
    const hex = hexInput.startsWith('#') ? hexInput : `#${hexInput}`;
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
      Alert.alert('格式錯誤', '請輸入 6 位 Hex 色碼，例如 #FF7F50');
      return;
    }
    setDraft(prev => prev.map((c, i) => (i === editIdx ? { ...c, hex } : c)));
    setEditIdx(null);
  }

  // Guide positions: top-left, center, bottom-right over the 200×200 image
  const guidePos = [
    { top: 20, left: 20 },
    { top: 80, left: 80 },
    { top: 140, left: 140 },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>確認主色（K-means 提取）</Text>

      {/* Image with color guide overlays */}
      <View style={styles.imageWrap}>
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        {draft.map((c, i) => (
          <View
            key={i}
            style={[
              styles.guideCircle,
              { top: guidePos[i]?.top ?? 20, left: guidePos[i]?.left ?? 20, backgroundColor: c.hex },
            ]}
          />
        ))}
      </View>

      <Text style={styles.hint}>點擊色票可修改顏色</Text>

      {/* Color swatches — 二次確認色票 */}
      <View style={styles.swatchRow}>
        {draft.map((c, i) => (
          <TouchableOpacity key={i} style={styles.swatchCard} onPress={() => openEdit(i)}>
            <View style={[styles.swatch, { backgroundColor: c.hex }]} />
            <Text style={styles.swatchHex}>{c.hex.toUpperCase()}</Text>
            <Text style={styles.swatchRatio}>{Math.round(c.ratio * 100)}%</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.btnBack} onPress={onBack}>
          <Text style={styles.btnBackTxt}>← 重選圖片</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnConfirm} onPress={() => onConfirm(draft)}>
          <Text style={styles.btnConfirmTxt}>確認顏色 →</Text>
        </TouchableOpacity>
      </View>

      {/* Hex edit modal */}
      <Modal transparent animationType="fade" visible={editIdx !== null}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditIdx(null)}>
          <View style={styles.hexModal} onStartShouldSetResponder={() => true}>
            <Text style={styles.hexModalTitle}>修改顏色 #{editIdx !== null ? editIdx + 1 : ''}</Text>
            {editIdx !== null && (
              <View style={[styles.hexPreview, { backgroundColor: hexInput.startsWith('#') ? hexInput : '#ccc' }]} />
            )}
            <TextInput
              style={styles.hexInput}
              value={hexInput}
              onChangeText={setHexInput}
              placeholder="#RRGGBB"
              autoCapitalize="characters"
              maxLength={7}
            />
            <TouchableOpacity style={styles.btnConfirm} onPress={applyHex}>
              <Text style={styles.btnConfirmTxt}>套用</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  imageWrap: { width: 200, height: 200, alignSelf: 'center', position: 'relative', borderRadius: 12, overflow: 'hidden' },
  image: { width: 200, height: 200 },
  guideCircle: {
    position: 'absolute', width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.4, shadowRadius: 2,
    elevation: 4,
  },
  hint: { textAlign: 'center', fontSize: 12, color: '#888', marginTop: 8, marginBottom: 16 },
  swatchRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 24 },
  swatchCard: { alignItems: 'center' },
  swatch: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#eee' },
  swatchHex: { fontSize: 11, marginTop: 6, fontWeight: '600' },
  swatchRatio: { fontSize: 11, color: '#888' },
  btnRow: { flexDirection: 'row', gap: 12 },
  btnBack: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  btnBackTxt: { color: '#555', fontWeight: '600' },
  btnConfirm: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#333', alignItems: 'center' },
  btnConfirmTxt: { color: '#fff', fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  hexModal: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: 280, alignItems: 'center' },
  hexModalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  hexPreview: { width: 64, height: 64, borderRadius: 32, marginBottom: 12, borderWidth: 1, borderColor: '#eee' },
  hexInput: {
    width: '100%', borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 10, fontSize: 16, textAlign: 'center', marginBottom: 16,
  },
});
