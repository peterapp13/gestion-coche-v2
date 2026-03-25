import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';

// This component handles the OAuth callback for web only
// Mobile uses WebBrowser which handles the callback differently

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    processSessionId();
  }, []);

  const processSessionId = async () => {
    try {
      // Extract session_id from URL fragment (web) or params (deep link)
      let sessionId = null;
      
      if (typeof window !== 'undefined' && window.location.hash) {
        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        sessionId = hashParams.get('session_id');
      }

      if (!sessionId) {
        console.error('No session_id found');
        router.replace('/');
        return;
      }

      // Exchange session_id for session_token
      const backendUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || '';
      const response = await fetch(`${backendUrl}/api/auth/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: sessionId }),
        credentials: 'include',
      });

      if (response.ok) {
        const user = await response.json();
        // Navigate to main app
        router.replace('/(tabs)');
      } else {
        console.error('Failed to exchange session');
        router.replace('/');
      }
    } catch (error) {
      console.error('Auth callback error:', error);
      router.replace('/');
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4285F4" />
      <Text style={styles.text}>Iniciando sesión...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
  },
});
