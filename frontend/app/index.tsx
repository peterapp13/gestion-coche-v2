import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

export default function LoginScreen() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const checkingAuth = useRef(false);

  useEffect(() => {
    if (checkingAuth.current) return;
    checkingAuth.current = true;

    // Check if user is already authenticated
    checkExistingAuth();
  }, []);

  const checkExistingAuth = async () => {
    try {
      const backendUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || '';
      const response = await fetch(`${backendUrl}/api/auth/me`, {
        credentials: 'include',
      });

      if (response.ok) {
        const user = await response.json();
        // User is authenticated, redirect to main app
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.log('Not authenticated:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      
      // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
      // Get the redirect URL dynamically
      let redirectUrl: string;
      
      if (Platform.OS === 'web') {
        // For web, MUST use window.location.origin directly (no env vars, no fallbacks)
        redirectUrl = typeof window !== 'undefined' 
          ? `${window.location.origin}/auth-callback`
          : '/auth-callback';
      } else {
        // For mobile, use the backend URL for deep linking
        const backendUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || '';
        redirectUrl = `${backendUrl}/auth-callback`;
      }
      
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      
      if (Platform.OS === 'web') {
        // On web, open in same window
        window.location.href = authUrl;
      } else {
        // On mobile, use WebBrowser
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
        
        if (result.type === 'success' && result.url) {
          // Extract session_id from the URL
          const url = new URL(result.url);
          const hash = url.hash.substring(1); // Remove the '#'
          const params = new URLSearchParams(hash);
          const sessionId = params.get('session_id');
          
          if (sessionId) {
            // Exchange session_id for session_token
            await exchangeSession(sessionId);
          }
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoading(false);
    }
  };

  const exchangeSession = async (sessionId: string) => {
    try {
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
        throw new Error('Failed to exchange session');
      }
    } catch (error) {
      console.error('Session exchange error:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4285F4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Car Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.carIcon}>🚗</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>Gestión de Vehículo</Text>
        <Text style={styles.subtitle}>Controla repostajes, recambios y mantenimiento</Text>

        {/* Login Button */}
        <TouchableOpacity 
          style={styles.googleButton}
          onPress={handleGoogleLogin}
          activeOpacity={0.8}
        >
          <View style={styles.googleIconContainer}>
            <Text style={styles.googleIcon}>G</Text>
          </View>
          <Text style={styles.googleButtonText}>Continuar con Google</Text>
        </TouchableOpacity>

        <Text style={styles.secureText}>🔒 Tus datos están seguros y sincronizados</Text>
      </View>
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
  content: {
    width: '100%',
    maxWidth: 400,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  carIcon: {
    fontSize: 80,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    marginBottom: 48,
    textAlign: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  googleIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    textAlign: 'center',
  },
  secureText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 24,
    textAlign: 'center',
  },
});
