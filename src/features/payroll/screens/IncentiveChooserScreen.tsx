import React from 'react';
import { View } from 'react-native';
import { ActionCard, Reveal } from '@/components/ui';
import { Screen } from '@/components/layout';
import { routes, useAppRouter } from '@/lib/navigation';
import { useTheme } from '@/theme';

/** Visible header strip of the first card; the second card covers the last COVER px of it (see QuickActions). */
const STRIP = 72;
const COVER = 24;

/**
 * "Select Incentive Type": chooser between Count Basis and Turnover Basis. A real page (v1 showed a modal over a blank
 * screen that stayed blank when navigating back); each target screen loads its own templates.
 */
export default function IncentiveChooserScreen() {
  const router = useAppRouter();
  const { colors } = useTheme();
  return (
    <Screen title="Select Incentive Type" large testID="payroll-incentive">
      <Reveal index={0}>
        <View>
          <ActionCard
            testID="incentive-count"
            icon="target"
            title="Count Basis"
            accent={colors.info}
            compact
            height={STRIP + COVER}
            onPress={() => router.push(routes.admin.payroll.countBasis)}
          />
          <View style={{ marginTop: -COVER }}>
            <ActionCard
              testID="incentive-turnover"
              icon="trending-up"
              title="Turnover Basis"
              accent={colors.warning}
              height={148}
              onPress={() => router.push(routes.admin.payroll.turnover)}
            />
          </View>
        </View>
      </Reveal>
    </Screen>
  );
}
