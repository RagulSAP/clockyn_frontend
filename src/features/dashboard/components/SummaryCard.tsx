import React from "react";
import { Pressable, View } from "react-native";

import { Card, ErrorState, Icon, Text } from "@/components/ui";
import { spacing } from "@/theme";
import type { DashboardStats } from "@/types/api/home";

import {
  NO_ATTENDANCE_TEXT,
  summaryFigures,
  type StaffFilter,
} from "../utils/dashboardLogic";
import { StaffOverviewRings } from "./StaffOverviewRings";

export type SummaryCardProps = {
  stats: DashboardStats | null | undefined;
  /** First load without any data yet. */
  loading?: boolean;
  /** Failed load without any data to show. */
  error?: string | null;
  onRetry?: () => void;
  /** Past date with nobody punched: figures are replaced by a message and nothing is tappable. */
  noData: boolean;
  /** Tap on a figure: open the staff list for that bucket. */
  onFigurePress: (filter: StaffFilter) => void;
  /** Tap on the card header: open the Overview screen. */
  onOpenOverview: () => void;
};

/** "Staff Overview": six attendance figures as a ring carousel; each opens the staff list, the header opens the Overview. */
export function SummaryCard({
  stats,
  loading,
  error,
  onRetry,
  noData,
  onFigurePress,
  onOpenOverview,
}: SummaryCardProps) {
  const figures = summaryFigures(stats);
  const showFigures = !noData && (stats || loading);

  return (
    <Card testID="summary-card">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Staff Overview, open overview"
        onPress={noData ? undefined : onOpenOverview}
        disabled={noData}
        testID="summary-open-overview"
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: spacing.md,
        }}
      >
        <Text variant="title3">Staff Overview</Text>
        {noData ? null : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
            <Text variant="callout" color="primary" weight="semibold">
              Overview
            </Text>
            <Icon name="chevron-right" size={16} color="primary" />
          </View>
        )}
      </Pressable>

      {noData ? (
        <Text
          variant="body"
          color="textSecondary"
          align="center"
          style={{ paddingVertical: spacing.xl }}
          testID="summary-no-data"
        >
          {NO_ATTENDANCE_TEXT}
        </Text>
      ) : error && !stats ? (
        <ErrorState compact message={error} onRetry={onRetry} />
      ) : showFigures ? (
        <StaffOverviewRings
          figures={figures}
          loading={!!loading && !stats}
          onFigurePress={onFigurePress}
        />
      ) : null}
    </Card>
  );
}
