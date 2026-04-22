import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

type Props<T extends string> = {
  label: string;
  value: T;
  options: { label: string; value: T }[];
  onChange: (v: T) => void;
};

export function TagPicker<T extends string>({ label, value, options, onChange }: Props<T>) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {options.map(o => (
          <TouchableOpacity
            key={o.value}
            style={[styles.chip, o.value === value && styles.chipActive]}
            onPress={() => onChange(o.value)}
          >
            <Text style={[styles.chipTxt, o.value === value && styles.chipTxtActive]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:        { marginBottom: 12 },
  label:       { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6 },
  row:         { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  chip:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#ddd', backgroundColor: '#fafafa' },
  chipActive:  { borderColor: '#333', backgroundColor: '#333' },
  chipTxt:     { fontSize: 13, color: '#555' },
  chipTxtActive: { color: '#fff', fontWeight: '600' },
});
