import React, { useMemo } from "react";
import { View } from "react-native";

import {
  Card,
  DateField,
  Select,
  Switch,
  type SelectOption,
} from "@/components/ui";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { spacing } from "@/theme";
import type { Branch } from "@/types/api/branches";

export type FilterBarProps = {
  branches: readonly Branch[];
  /** '' = ALL. */
  branchId: string;
  onBranchChange: (branchId: string) => void;
  deptOn: boolean;
  onDeptChange: (on: boolean) => void;
  /** `YYYY-MM-DD` (IST). */
  date: string;
  /** Latest selectable date (today, IST). */
  maxDate: string;
  onDateChange: (date: string) => void;
};

/** Branch (ALL + branches), Department-mode switch and Date (never in the future). */
export function FilterBar({
  branches,
  branchId,
  onBranchChange,
  deptOn,
  onDeptChange,
  date,
  maxDate,
  onDateChange,
}: FilterBarProps) {
  const { isPhone } = useBreakpoint();
  const options = useMemo<SelectOption<string>[]>(
    () => [
      { label: "ALL", value: "" },
      ...branches.map((b) => ({ label: b.name, value: b.id })),
    ],
    [branches],
  );

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.md,
        alignItems: "flex-end",
      }}
      testID="filter-bar"
    >
      <View
        style={{ flexGrow: 1, flexBasis: isPhone ? "45%" : 200, minWidth: 140 }}
      >
        <Select<string>
          label="Branch"
          title="Select branch"
          value={branchId}
          options={options}
          onChange={onBranchChange}
          leftIcon="building-2"
          searchable={options.length > 8}
          testID="filter-branch"
        />
      </View>
      <View
        style={{ flexGrow: 1, flexBasis: isPhone ? "45%" : 200, minWidth: 140 }}
      >
        <DateField
          label="Date"
          value={date}
          maxDate={maxDate}
          onChange={onDateChange}
          testID="filter-date"
        />
      </View>
      <Card
        variant="outlined"
        padding={spacing.md}
        style={{ flexGrow: isPhone ? 1 : 0, minWidth: 180 }}
      >
        <Switch
          label="Department"
          value={deptOn}
          onValueChange={onDeptChange}
          testID="filter-department"
          accessibilityLabel="Department view"
        />
      </Card>
    </View>
  );
}
