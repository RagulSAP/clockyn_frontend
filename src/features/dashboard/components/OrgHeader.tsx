import React from "react";
import { Platform, Pressable, View } from "react-native";

import { Avatar, IconButton, Text } from "@/components/ui";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { spacing } from "@/theme";

export type OrgHeaderProps = {
  companyName: string;
  logoUrl: string | null | undefined;
  /** Tap on the name area: company management. */
  onPressCompany: () => void;
  /** Tap on the logo: full-screen logo viewer. */
  onPressLogo: () => void;
  /** Open the company switcher. */
  onSwitchCompany: () => void;
  /** Web has no pull-to-refresh: an explicit refresh button is shown there. */
  onRefresh?: () => void;
  refreshing?: boolean;
};

/** Organisation header of the dashboard: logo, company name (tap -> company), switch-company button. */
export function OrgHeader({
  companyName,
  logoUrl,
  onPressCompany,
  onPressLogo,
  onSwitchCompany,
  onRefresh,
  refreshing,
}: OrgHeaderProps) {
  const { isPhone } = useBreakpoint();
  return (
    <View
      testID="org-header"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: isPhone ? spacing.lg : spacing.xxl,
        paddingTop: spacing.sm,
        paddingBottom: spacing.xs,
        minHeight: 64,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View company logo"
        onPress={onPressLogo}
        testID="org-logo"
      >
        <Avatar uri={logoUrl} name={companyName} size={48} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${companyName || "Company"}, manage company`}
        onPress={onPressCompany}
        style={{ flex: 1 }}
        testID="org-name"
      >
        <Text variant="title2" numberOfLines={1}>
          {companyName || " "}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          Manage company
        </Text>
      </Pressable>
      {Platform.OS === "web" && onRefresh ? (
        <IconButton
          icon="refresh"
          variant="plain"
          accessibilityLabel="Refresh"
          onPress={onRefresh}
          disabled={refreshing}
        />
      ) : null}
      <IconButton
        icon="chevrons-up-down"
        variant="tonal"
        accessibilityLabel="Switch company"
        onPress={onSwitchCompany}
        testID="switch-company"
      />
    </View>
  );
}
