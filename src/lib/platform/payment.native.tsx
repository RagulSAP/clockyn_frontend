/**
 * Payment — NATIVE implementation: Razorpay checkout inside a full-screen modal WebView.
 *
 * `openCheckout()` is imperative; the modal is rendered by `<CheckoutHost />`, which MUST be mounted once
 * in the root layout (inside the ThemeProvider). If no host is mounted, `openCheckout` resolves
 * `{ status: 'failed', error }` instead of hanging.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useTheme } from '@/theme';
import {
  CHECKOUT_ORIGIN,
  buildCheckoutHtml,
  parseCheckoutMessage,
  type CheckoutOptions,
  type CheckoutResult,
} from './paymentCore';

export type { CheckoutOptions, CheckoutResult } from './paymentCore';

type Request = { options: CheckoutOptions; html: string; resolve: (r: CheckoutResult) => void };
type HostSetter = (req: Request | null) => void;

let hostSetter: HostSetter | null = null;
let active: Request | null = null;

export function openCheckout(options: CheckoutOptions): Promise<CheckoutResult> {
  return new Promise<CheckoutResult>((resolve) => {
    if (!hostSetter) {
      resolve({ status: 'failed', error: 'Payment checkout is not available right now.' });
      return;
    }
    if (active) {
      resolve({ status: 'failed', error: 'A payment is already in progress.' });
      return;
    }
    const req: Request = { options, html: buildCheckoutHtml(options), resolve };
    active = req;
    hostSetter(req);
  });
}

const HTTP_LIKE = /^(https?:|about:|data:|blob:)/i;

export function CheckoutHost(): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [request, setRequest] = useState<Request | null>(null);
  const settled = useRef(false);

  useEffect(() => {
    hostSetter = (req) => {
      settled.current = false;
      setRequest(req);
    };
    return () => {
      hostSetter = null;
      if (active) {
        active.resolve({ status: 'dismissed' });
        active = null;
      }
    };
  }, []);

  const finish = useCallback((result: CheckoutResult) => {
    if (settled.current) return;
    settled.current = true;
    const req = active;
    active = null;
    setRequest(null);
    req?.resolve(result);
  }, []);

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      const result = parseCheckoutMessage(e.nativeEvent.data);
      if (result) finish(result);
    },
    [finish],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: theme.colors.background },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
        title: { color: theme.colors.text, fontSize: 17, fontWeight: '600' },
        close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
        closeText: { color: theme.colors.primary, fontSize: 15, fontWeight: '600' },
        web: { flex: 1, backgroundColor: '#FFFFFF' },
      }),
    [theme],
  );

  return (
    <Modal
      visible={request !== null}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => finish({ status: 'dismissed' })}
      statusBarTranslucent
    >
      <View style={styles.root} testID="checkout-modal">
        <View style={[styles.header, { paddingTop: insets.top + theme.spacing.md }]}>
          <Text style={styles.title}>Secure Payment</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close payment"
            onPress={() => finish({ status: 'dismissed' })}
            style={styles.close}
            hitSlop={8}
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
        {request ? (
          <WebView
            style={styles.web}
            originWhitelist={['*']}
            source={{ html: request.html, baseUrl: CHECKOUT_ORIGIN }}
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
            onMessage={onMessage}
            onShouldStartLoadWithRequest={(req) => {
              if (HTTP_LIKE.test(req.url)) return true;
              // UPI / wallet app deep links (upi:, intent:, tez:, phonepe: …) → hand over to the OS.
              void Linking.openURL(req.url).catch(() => undefined);
              return false;
            }}
            onError={() => finish({ status: 'failed', error: 'Could not load the payment checkout.' })}
          />
        ) : null}
      </View>
    </Modal>
  );
}
