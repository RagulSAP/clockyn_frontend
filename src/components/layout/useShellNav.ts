import { useCallback, useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';

import { useToast } from '@/components/ui';
import { useOrgPlan } from '@/hooks';
import { useRole } from '@/store/auth';
import { useBadges } from '@/store/badges';
import {
  activeTabKey,
  decideCrmPress,
  normalizePathname,
  SHELL_TABS,
  shouldUseSidebar,
  tabBadgeCount,
  variantForRole,
  type ShellTab,
  type ShellTabKey,
  type ShellVariant,
} from './shellNav';

export type ShellNavItem = ShellTab & { active: boolean; badge: number };

/** True when the shell shows the sidebar instead of the bottom tab bar (wide web / tablets). */
export function useIsWideShell(): boolean {
  const { width, height } = useWindowDimensions();
  return shouldUseSidebar({ width, height, platform: Platform.OS });
}

/**
 * Shared state of the bottom tab bar and the sidebar: the role's tabs, the active tab (derived from the
 * pathname, so it is right on tab roots, nested screens and deep links), live badges and the press handler
 * (plan gate for CRM, real navigation to the tab root for every tab — "Home" no longer means `router.back()`).
 */
export function useShellNav(): { variant: ShellVariant; items: ShellNavItem[]; activeKey: ShellTabKey | null; onPress: (key: ShellTabKey) => void } {
  const role = useRole();
  const variant = variantForRole(role);
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const plan = useOrgPlan();
  const badges = useBadges();

  const activeKey = activeTabKey(pathname, variant);

  const items = useMemo<ShellNavItem[]>(
    () =>
      SHELL_TABS[variant].map((tab) => ({
        ...tab,
        active: tab.key === activeKey,
        badge: tabBadgeCount(tab.key, badges, activeKey),
      })),
    [variant, activeKey, badges],
  );

  const onPress = useCallback(
    (key: ShellTabKey) => {
      const tab = SHELL_TABS[variant].find((t) => t.key === key);
      if (!tab) return;
      if (key === 'crm') {
        const decision = decideCrmPress(plan);
        if (!decision.allowed) {
          toast.info(decision.message);
          return;
        }
      }
      // Already on the tab root: nothing to do (v1 re-pushed the same route).
      if (normalizePathname(pathname) === tab.route) return;
      router.navigate(tab.route as Href);
    },
    [variant, plan, toast, pathname, router],
  );

  return { variant, items, activeKey, onPress };
}
