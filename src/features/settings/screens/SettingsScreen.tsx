import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Screen, useBreakpoint } from '@/components/layout';
import { BottomSheet, Card, ListItem, SegmentedControl, useConfirm, useToast, Text, Icon, Reveal } from '@/components/ui';
import { useOrgPlan } from '@/hooks';
import { useAppRouter } from '@/lib/navigation';
import { signOut, useRole, useSession } from '@/store/auth';
import { radii, spacing, useThemePreference, type ThemePreference } from '@/theme';

import { MenuChildren, SectionCard } from '../components/SectionCard';
import { salaryGate } from '../utils/salaryGate';
import {
  DESKTOP_COLUMNS,
  INCENTIVE_OPTIONS,
  SETTINGS_SECTIONS,
  type MenuAction,
  type MenuLeaf,
  type MenuSection,
  type SectionId,
} from '../utils/settingsMenu';

const THEME_OPTIONS: { label: string; value: ThemePreference }[] = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
];

/** Admin settings hub: plan, company, salary, attendance, reports, managers, expenses, appearance and "Beyond". */
export default function SettingsScreen() {
  const router = useAppRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const session = useSession();
  const role = useRole();
  const plan = useOrgPlan();
  const { isDesktop } = useBreakpoint();
  const { preference, setPreference } = useThemePreference();

  const [openSection, setOpenSection] = useState<SectionId | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [incentiveOpen, setIncentiveOpen] = useState(false);

  // Refer & Earn belongs to the organisation admin (billing-style rows are never shown to managers).
  const sections = useMemo(() => SETTINGS_SECTIONS.filter((s) => s.id !== 'referral' || role === 1), [role]);
  const gate = useMemo(() => salaryGate(plan.status), [plan.status]);

  const toggleSection = useCallback((id: SectionId) => {
    setOpenSection((cur) => (cur === id ? null : id));
    setOpenGroup(null); // leaving / switching sections collapses the nested "Incentive / OT / Bonus" group
  }, []);

  const logout = useCallback(async () => {
    const ok = await confirm({ title: 'Logout', message: 'Are you sure you want to logout?', confirmText: 'Logout', destructive: true });
    if (!ok) return;
    try {
      await signOut(); // the route guards react to the cleared session; no manual navigation
    } catch {
      toast.error('Could not log out. Please try again.');
    }
  }, [confirm, toast]);

  const runAction = useCallback(
    (action: MenuAction) => {
      switch (action.type) {
        case 'route':
          router.push(action.route);
          return;
        case 'toast':
          toast.info(action.message);
          return;
        case 'incentive':
          setIncentiveOpen(true);
          return;
        case 'logout':
          void logout();
          return;
      }
    },
    [router, toast, logout],
  );

  const onSectionPress = (section: MenuSection) => {
    if (section.id === 'salary' && gate.blocked) {
      toast.info(gate.message);
      return;
    }
    if (section.kind === 'accordion') toggleSection(section.id);
    else if (section.route) router.push(section.route);
  };

  const renderSection = (section: MenuSection) => {
    if (section.kind === 'appearance') {
      return (
        <Card key={section.id} testID="section-appearance" style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Icon name="palette" size={20} color="primary" />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{section.title}</Text>
              <Text variant="caption" color="textMuted">
                {section.subtitle}
              </Text>
            </View>
          </View>
          <SegmentedControl options={THEME_OPTIONS} value={preference} onChange={setPreference} testID="appearance-control" />
        </Card>
      );
    }
    const open = openSection === section.id;
    const subtitle = section.id === 'salary' ? gate.subtitle : undefined;
    const items = section.children ?? [];
    return (
      <SectionCard key={section.id} section={section} subtitle={subtitle} open={open && !(section.id === 'salary' && gate.blocked)} onPress={() => onSectionPress(section)}>
        <MenuChildren
          items={items}
          onLeafPress={(leaf: MenuLeaf) => runAction(leaf.action)}
          openGroupId={openGroup}
          onToggleGroup={(id) => setOpenGroup((cur) => (cur === id ? null : id))}
        />
      </SectionCard>
    );
  };

  const byId = (id: SectionId) => sections.find((s) => s.id === id);

  return (
    <Screen title="Settings" subtitle={session?.orgName || undefined} hideBack edges={['top']} large testID="settings-screen">
      {isDesktop ? (
        <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' }}>
          {DESKTOP_COLUMNS.map((ids, i) => (
            <Reveal key={i} index={i} style={{ flex: 1, gap: spacing.md }}>
              {ids.map((id) => {
                const s = byId(id);
                return s ? renderSection(s) : null;
              })}
            </Reveal>
          ))}
        </View>
      ) : (
        <Reveal style={{ gap: spacing.md }}>{sections.map(renderSection)}</Reveal>
      )}

      <BottomSheet visible={incentiveOpen} onClose={() => setIncentiveOpen(false)} title="Select Incentive Type" size="sm" testID="incentive-sheet">
        <Card padding={0}>
          <View style={{ borderRadius: radii.lg, overflow: 'hidden' }}>
            {INCENTIVE_OPTIONS.map((opt, i) => (
              <ListItem
                key={opt.id}
                icon={opt.id === 'count' ? 'hash' : 'trending-up'}
                title={opt.title}
                divider={i < INCENTIVE_OPTIONS.length - 1}
                onPress={() => {
                  setIncentiveOpen(false);
                  router.push(opt.route);
                }}
                testID={`incentive-${opt.id}`}
              />
            ))}
          </View>
        </Card>
      </BottomSheet>
    </Screen>
  );
}
