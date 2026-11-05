import React from "react";
import { View } from "react-native";

import { Button, Icon, Modal, Text } from "@/components/ui";
import { radii, spacing, useTheme } from "@/theme";

import { tint } from "../utils/color";
import { planPopupContent, type PlanPopupType } from "../utils/planPopup";

export type PlanExpiryModalProps = {
  type: PlanPopupType | null;
  endDate: string;
  /** Primary button (Upgrade Plan / Renew Plan). The caller closes the popup and navigates. */
  onPrimary: () => void;
  /** "Skip for now" / scrim / back. Ignored for an expired plan. */
  onDismiss: () => void;
};

/** Plan-expiry popup. An expired plan cannot be dismissed: only the Renew button leaves it. */
export function PlanExpiryModal({
  type,
  endDate,
  onPrimary,
  onDismiss,
}: PlanExpiryModalProps) {
  const { colors } = useTheme();
  if (!type) return null;
  const content = planPopupContent(type, endDate);
  const color = content.tone === "danger" ? colors.danger : colors.warning;
  return (
    <Modal
      visible
      onClose={onDismiss}
      dismissible={content.dismissible}
      size="sm"
      testID="plan-expiry-modal"
      footer={
        <View style={{ gap: spacing.sm }}>
          <Button
            title={content.primaryLabel}
            variant={content.tone === "danger" ? "danger" : "primary"}
            fullWidth
            onPress={onPrimary}
            testID="plan-popup-primary"
          />
          {content.dismissible ? (
            <Button
              title="Skip for now"
              variant="ghost"
              fullWidth
              onPress={onDismiss}
              testID="plan-popup-skip"
            />
          ) : null}
        </View>
      }
    >
      <View
        style={{
          alignItems: "center",
          gap: spacing.md,
          paddingVertical: spacing.sm,
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: radii.pill,
            backgroundColor: tint(color, 0.14),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            name={content.tone === "danger" ? "alert-circle" : "hourglass"}
            size={30}
            color={color}
          />
        </View>
        <Text variant="title2" align="center" accessibilityRole="header">
          {content.title}
        </Text>
        <Text variant="body" color="textSecondary" align="center">
          {content.message}
        </Text>
      </View>
    </Modal>
  );
}
