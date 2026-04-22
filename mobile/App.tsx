import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { setAuthExpiredHandler } from './src/api/client';
import { API_BASE_URL } from './src/api/config';
import { AppNavigator } from './src/navigation/AppNavigator';
import { LoginScreen } from './src/screens/LoginScreen';

type AuthState = 'checking' | 'logged_in' | 'logged_out';

export default function App() {
  const [authState, setAuthState] = useState<AuthState>('checking');

  const handleLogin  = useCallback(() => setAuthState('logged_in'),  []);
  const handleLogout = useCallback(() => setAuthState('logged_out'), []);

  // Register global auth-expiry handler so client.ts can kick user to login
  useEffect(() => {
    setAuthExpiredHandler(handleLogout);
  }, [handleLogout]);

  // Wake up Render free-tier server on app start (cold start takes 30-60s)
  useEffect(() => {
    fetch(`${API_BASE_URL}/test`).catch(() => {});
  }, []);

  // On launch: check if a valid access_token exists
  useEffect(() => {
    AsyncStorage.getItem('access_token')
      .then(token => setAuthState(token ? 'logged_in' : 'logged_out'))
      .catch(() => setAuthState('logged_out'));
  }, []);

  if (authState === 'checking') {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
          <ActivityIndicator size="large" color="#222" />
        </View>
      </SafeAreaProvider>
    );
  }

  if (authState === 'logged_out') {
    return (
      <SafeAreaProvider>
        <LoginScreen onLogin={handleLogin} />
        <StatusBar style="dark" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppNavigator onLogout={handleLogout} />
        <StatusBar style="dark" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
