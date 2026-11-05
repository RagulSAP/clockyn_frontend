import React from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { contentMaxWidth, spacing, useTheme } from '@/theme';
import { IconButton } from '@/components/ui';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { ResponsiveContainer } from './ResponsiveContainer';
import { ScreenHeader } from './ScreenHeader';

export type ScreenEdge = 'top' | 'bottom';

export type ScreenProps = {
  children?: React.ReactNode;
  /** Wrap content in a ScrollView (default). Set false for screens that own their scrolling (FlatList, map…). */
  scroll?: boolean;
  /** Pull-to-refresh (native) + an automatic refresh button in the header on web. */
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Custom header node (replaces the standard header). */
  header?: React.ReactNode;
  title?: string;
  subtitle?: string;
  /** Back handler. Defaults to `router.back()` (falling back to `/` when there is no history). */
  onBack?: () => void;
  /** Never show the back button (tab roots). */
  hideBack?: boolean;
  /** Trailing header actions. */
  right?: React.ReactNode;
  /** Large title style for the standard header. */
  large?: boolean;
  /** Horizontal + top/bottom padding around the content (default true). */
  padded?: boolean;
  /** Lift content above the keyboard (default true). */
  keyboardAware?: boolean;
  /** Sticky footer pinned above the safe area (primary actions of a form). */
  footer?: React.ReactNode;
  /** Rendered over the whole screen, outside the scroll area (FAB, floating banners). */
  overlay?: React.ReactNode;
  /** Max content width on wide screens (default `contentMaxWidth`). */
  maxWidth?: number;
  /** Safe-area edges to pad. Tab roots under a tab bar pass `['top']`. Default both. */
  edges?: ScreenEdge[];
  /** Override the page background (token colour value). */
  backgroundColor?: string;
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function defaultBack() {
  try {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  } catch {
    /* navigation not ready */
  }
}

/**
 * Standard page scaffold: safe areas, header, scrolling content (centred and width-capped on wide screens),
 * keyboard avoidance, pull-to-refresh and a sticky footer.
 */
export function Screen({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
  header,
  title,
  subtitle,
  onBack,
  hideBack,
  right,
  large,
  padded = true,
  keyboardAware = true,
  footer,
  overlay,
  maxWidth = contentMaxWidth,
  edges = ['top', 'bottom'],
  backgroundColor,
  contentStyle,
  style,
  testID,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = React.useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const top = edges.includes('top') ? insets.top : 0;
  const bottom = edges.includes('bottom') ? insets.bottom : 0;

  // Always offered on stack screens: after a reload / deep link there is no history (and on phones no tab bar), so a
  // missing button would be a dead end. `defaultBack` falls back to the root redirect (the role's home) then.
  const showBack = !hideBack;
  const webRefresh =
    Platform.OS === 'web' && onRefresh ? (
      <IconButton icon="refresh" variant="plain" accessibilityLabel="Refresh" onPress={onRefresh} disabled={refreshing} />
    ) : null;
  const headerRight =
    right || webRefresh ? (
      <>
        {right}
        {webRefresh}
      </>
    ) : undefined;

  const headerNode =
    header ??
    (title ? (
      <ScreenHeader title={title} subtitle={subtitle} large={large} onBack={showBack ? (onBack ?? defaultBack) : undefined} right={headerRight} />
    ) : null);

  const contentPad = padded ? { paddingTop: headerNode ? spacing.sm : spacing.lg } : null;

  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: footer ? spacing.lg : bottom + spacing.xxl }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios' && !keyboardAware}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh && Platform.OS !== 'web' ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        ) : undefined
      }
    >
      <ResponsiveContainer maxWidth={maxWidth} padded={padded} style={[{ flexGrow: 1 }, contentPad, contentStyle]}>
        {children}
      </ResponsiveContainer>
    </ScrollView>
  ) : (
    <ResponsiveContainer maxWidth={maxWidth} padded={padded} fill style={[contentPad, contentStyle]}>
      {children}
    </ResponsiveContainer>
  );

  const inner = (
    <>
      <View style={{ paddingTop: top }}>
        {headerNode ? (
          <ResponsiveContainer maxWidth={maxWidth}>{headerNode}</ResponsiveContainer>
        ) : null}
      </View>
      {body}
      {footer ? (
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: spacing.md,
            paddingBottom: Math.max(bottom, spacing.md),
          }}
        >
          <ResponsiveContainer maxWidth={maxWidth} padded>
            {footer}
          </ResponsiveContainer>
        </View>
      ) : null}
    </>
  );

  return (
    <View testID={testID} style={[{ flex: 1, backgroundColor: backgroundColor ?? colors.background }, style]}>
      {keyboardAware ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
      {overlay}
    </View>
  );
}
