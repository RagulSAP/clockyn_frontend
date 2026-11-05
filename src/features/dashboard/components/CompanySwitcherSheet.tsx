import React from "react";
import { View } from "react-native";

import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  ListItem,
  SkeletonList,
  Avatar,
  BottomSheet,
} from "@/components/ui";
import type { Company } from "@/types/api/company";

export type CompanySwitcherSheetProps = {
  visible: boolean;
  onClose: () => void;
  companies: readonly Company[] | undefined;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  currentOrgId: string;
  /** Tapping the current company only closes the sheet. */
  onSelect: (company: Company) => void;
  onAddCompany: () => void;
};

/** "Switch Company": the admin's companies (current one marked), plus "Add New Company". */
export function CompanySwitcherSheet({
  visible,
  onClose,
  companies,
  loading,
  error,
  onRetry,
  currentOrgId,
  onSelect,
  onAddCompany,
}: CompanySwitcherSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Switch Company"
      testID="company-switcher"
      footer={
        <Button
          title="Add New Company"
          icon="plus"
          variant="secondary"
          fullWidth
          onPress={onAddCompany}
          testID="add-company"
        />
      }
    >
      {loading && !companies ? (
        <SkeletonList count={3} />
      ) : error && !companies ? (
        <ErrorState compact message={error} onRetry={onRetry} />
      ) : companies && companies.length === 0 ? (
        <EmptyState
          compact
          icon="building-2"
          title="No companies"
          message="Add a company to get started."
        />
      ) : (
        <View>
          {(companies ?? []).map((company, index) => {
            const current = company.orgId === currentOrgId;
            return (
              <ListItem
                key={company.orgId}
                testID={`company-${company.orgId}`}
                title={company.name}
                subtitle={company.address || undefined}
                left={<Avatar name={company.name} size={40} />}
                right={
                  current ? (
                    <Icon
                      name="check"
                      size={20}
                      color="primary"
                      accessibilityLabel="Current company"
                    />
                  ) : undefined
                }
                chevron={false}
                divider={index < (companies?.length ?? 0) - 1}
                onPress={() => (current ? onClose() : onSelect(company))}
              />
            );
          })}
        </View>
      )}
    </BottomSheet>
  );
}
