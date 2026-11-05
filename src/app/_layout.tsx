import React, { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { Stack, type NativeStackNavigationOptions } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { isAppReady, SPLASH_SAFETY_TIMEOUT_MS } from '@/components/layout/appReady';
import { Bootstrap } from '@/components/layout/Bootstrap';
import { BrandSplash } from '@/components/layout/BrandSplash';
import { GestureRoot } from '@/components/layout/GestureRoot';
import { ToastProvider } from '@/components/ui';
import { CheckoutHost } from '@/lib/platform/payment';
import { QueryProvider } from '@/lib/query';
import { useAuthHydrated } from '@/store/auth';
import { ThemeProvider, useTheme } from '@/theme';
import { clockynFontMap } from '@/theme/fonts';

// Keep the native splash up until fonts + the persisted session are ready (no-op on web).
SplashScreen.preventAutoHideAsync().catch(() => undefined);
try {
  SplashScreen.setOptions({ duration: 250, fade: true });
} catch {
  /* older native shells */
}

/** Entry / auth screens fade in and cannot be swiped back; everything else slides from the right (v1 behaviour). */
const FADE_ROUTES = new Set(['index', 'admin-login', 'staff-login']);
const rootScreenOptions = ({ route }: { route: { name: string } }): NativeStackNavigationOptions => {
  const fade = FADE_ROUTES.has(route.name);
  return { headerShown: false, animation: fade ? 'fade' : 'slide_from_right', gestureEnabled: !fade };
};

function useAppReady(): boolean {
  const [fontsLoaded, fontError] = useFonts(clockynFontMap);
  const hydrated = useAuthHydrated();
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), SPLASH_SAFETY_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, []);
  return isAppReady({ fontsLoaded, fontError: !!fontError, hydrated, timedOut });
}

function RootContent() {
  const { isDark } = useTheme();
  const ready = useAppReady();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {ready ? (
        <>
          <Stack screenOptions={rootScreenOptions} />
          <Bootstrap />
        </>
      ) : (
        <BrandSplash />
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureRoot style={styles.fill}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryProvider>
            <ToastProvider>
              <RootContent />
              {/* Razorpay checkout modal (native) — `openCheckout()` is imperative, this host must be mounted once. */}
              <CheckoutHost />
            </ToastProvider>
          </QueryProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureRoot>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
