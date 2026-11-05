import React from "react";
import { Pressable, View } from "react-native";

import { Card, Icon, Text, type IconName } from "@/components/ui";
import { radii, spacing, useTheme } from "@/theme";
import type { DepartmentStats } from "@/types/api/home";

import { departmentBadges, type StaffFilter } from "../utils/dashboardLogic";
import { tint } from "../utils/color";
import { filterColor } from "../utils/statusColors";

const BADGE_ICONS: Record<string, IconName> = {
  total: "users",
  absent: "user-x",
  late: "clock",
  working: "user-check",
  punch_in: "login",
  punch_out: "logout",
};

export type DepartmentCardProps = {
  dept: DepartmentStats;
  onStatPress: (dept: DepartmentStats, filter: StaffFilter) => void;
};

/** One department with six tappable stat badges (Total, Absent, Late, Working, Punch In, Punch Out). */
export function DepartmentCard({ dept, onStatPress }: DepartmentCardProps) {
  const { colors } = useTheme();
  const badges = departmentBadges(dept);
  return (
    <Card testID={`dept-card-${dept.deptId || dept.deptName}`}>
      <Text
        variant="title3"
        numberOfLines={2}
        style={{ marginBottom: spacing.md }}
      >
        {dept.deptName}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {badges.map((b) => {
          const color = filterColor(colors, b.filter);
          return (
            <Pressable
              key={b.key}
              accessibilityRole="button"
              accessibilityLabel={`${dept.deptName} ${b.label}: ${b.value}`}
              onPress={() => onStatPress(dept, b.filter)}
              testID={`dept-${dept.deptId || dept.deptName}-${b.key}`}
              style={({ pressed }) => ({
                flexBasis: "31%",
                flexGrow: 1,
                borderRadius: radii.md,
                backgroundColor: tint(color, 0.1),
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.sm,
                gap: 2,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Icon
                  name={BADGE_ICONS[b.key] ?? "circle"}
                  size={13}
                  color={color}
                />
                <Text
                  variant="caption"
                  color="textSecondary"
                  numberOfLines={1}
                  style={{ flexShrink: 1 }}
                >
                  {b.label}
                </Text>
              </View>
              <Text variant="title2" style={{ color }}>
                {b.value}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}
