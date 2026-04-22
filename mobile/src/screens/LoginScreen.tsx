import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../api/config';

type Props = { onLogin: () => void };

export function LoginScreen({ onLogin }: Props) {
  const [mode, setMode]         = useState<'login' | 'register'>('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit() {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      Alert.alert('請填寫 Email 和密碼'); return;
    }
    if (password.length < 8) {
      Alert.alert('密碼至少 8 個字元'); return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const regRes = await fetch(`${API_BASE_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmedEmail, password }),
        });
        const regData = await regRes.json();
        if (!regRes.ok) {
          Alert.alert('註冊失敗', regData.error ?? `HTTP ${regRes.status}`); return;
        }
      }

      const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok) {
        Alert.alert('登入失敗', loginData.error ?? `HTTP ${loginRes.status}`); return;
      }

      await AsyncStorage.multiSet([
        ['access_token',  loginData.access_token],
        ['refresh_token', loginData.refresh_token],
      ]);
      onLogin();
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        Alert.alert('伺服器回應逾時', '伺服器可能正在喚醒（Render 免費方案約需 30~60 秒），請稍等片刻後再試。');
      } else {
        Alert.alert('連線失敗', '請確認手機已連上網路，或稍後再試。');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">

          {/* Logo area */}
          <View style={s.logoArea}>
            <Text style={s.appIcon}>👗</Text>
            <Text style={s.appName}>Wardrobe AI</Text>
            <Text style={s.appSub}>你的智慧穿搭助理</Text>
          </View>

          {/* Mode toggle */}
          <View style={s.modeRow}>
            <TouchableOpacity
              style={[s.modeBtn, mode === 'login' && s.modeBtnActive]}
              onPress={() => setMode('login')}
            >
              <Text style={[s.modeTxt, mode === 'login' && s.modeTxtActive]}>登入</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.modeBtn, mode === 'register' && s.modeBtnActive]}
              onPress={() => setMode('register')}
            >
              <Text style={[s.modeTxt, mode === 'register' && s.modeTxtActive]}>註冊</Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={s.form}>
            <Text style={s.fieldLabel}>Email</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor="#bbb"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={s.fieldLabel}>密碼{mode === 'register' ? '（至少 8 字元）' : ''}</Text>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#bbb"
              secureTextEntry
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[s.submitBtn, loading && s.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.submitTxt}>{mode === 'login' ? '登入' : '註冊並登入'}</Text>
              }
            </TouchableOpacity>
          </View>

          <Text style={s.hint}>
            {mode === 'login'
              ? '還沒有帳號？點「註冊」建立新帳號'
              : '已有帳號？點「登入」直接進入'}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  body:   { padding: 28, paddingTop: 40, flexGrow: 1 },

  logoArea: { alignItems: 'center', marginBottom: 36 },
  appIcon:  { fontSize: 56, marginBottom: 8 },
  appName:  { fontSize: 26, fontWeight: '800', color: '#1a1a1a' },
  appSub:   { fontSize: 14, color: '#888', marginTop: 4 },

  modeRow:       { flexDirection: 'row', backgroundColor: '#f3f3f3', borderRadius: 12, padding: 4, marginBottom: 28 },
  modeBtn:       { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  modeBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  modeTxt:       { fontSize: 15, fontWeight: '600', color: '#888' },
  modeTxtActive: { color: '#222' },

  form:       { gap: 6, marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 4, marginTop: 8 },
  input: {
    borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#222', backgroundColor: '#fafafa',
  },

  submitBtn: {
    marginTop: 20, backgroundColor: '#222', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },

  hint: { textAlign: 'center', fontSize: 13, color: '#aaa', marginTop: 8 },
});
