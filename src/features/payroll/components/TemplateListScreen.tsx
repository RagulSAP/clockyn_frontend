import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { spacing } from '@/theme';
import { Button, EmptyState, ErrorState, SectionHeader, SkeletonList, useToast } from '@/components/ui';
import { ResponsiveRow, Screen } from '@/components/layout';
import { useAsyncAction } from '@/hooks';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId } from '@/store/auth';
import { hasErrors, type FieldErrors } from '../types';
import type { FormApi, TemplateTypeConfig } from '../config/types';
import { deletableTemplateId, nextTemplateNumber, type TemplateBase } from '../utils/templates';
import { AssignStaffModal } from './AssignStaffModal';
import { TemplateCard } from './TemplateCard';
import { TemplateFormModal } from './TemplateFormModal';

export interface TemplateListScreenProps<T extends TemplateBase, F extends object> {
  config: TemplateTypeConfig<T, F>;
}

/**
 * The shared "numbered template" page: header with Add, template cards (⋮ actions, inline delete confirmation on the
 * highest-numbered template only), add / edit dialog and the assign-staff dialog. Everything type specific (fields,
 * validation, payload, copy, endpoints) comes from `config`.
 */
export function TemplateListScreen<T extends TemplateBase, F extends object>({ config }: TemplateListScreenProps<T, F>) {
  const orgId = useOrgId();
  const toast = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.payroll.templates(orgId, config.kind),
    queryFn: () => config.api.list(orgId),
    enabled: orgId !== '',
  });
  const items = useMemo(() => query.data ?? [], [query.data]);
  const deletableId = deletableTemplateId(items);

  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [values, setValues] = useState<F>(() => config.initialForm(null));
  const [errors, setErrors] = useState<FieldErrors<F>>({});
  const [assignId, setAssignId] = useState<string | null>(null);

  const nextName = nextTemplateNumber(items);
  const assignItem = items.find((t) => t.id === assignId) ?? null;

  const refreshAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.payroll.all(orgId) });
  }, [queryClient, orgId]);

  const openForm = (target: T | null) => {
    setEditing(target);
    setValues(config.initialForm(target));
    setErrors({});
    setMenuId(null);
    setConfirmId(null);
    setFormOpen(true);
  };
  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setErrors({});
  };

  const saveAction = useAsyncAction(
    () => config.save({ orgId, form: values, editing, items, nextName }),
    {
      errorMessage: config.messages.saveFailed,
      onSuccess: () => {
        toast.success(editing ? config.messages.updated : config.messages.saved);
        closeForm();
        refreshAll();
      },
    },
  );

  const submit = () => {
    const found = config.validate(values, { items, editing });
    setErrors(found);
    if (!hasErrors(found)) void saveAction.run();
  };

  const deleteAction = useAsyncAction(
    async (id: string) => {
      await config.api.remove(id);
    },
    {
      errorMessage: config.messages.deleteFailed,
      onSuccess: () => {
        toast.success(config.messages.deleted);
        setConfirmId(null);
        setMenuId(null);
        refreshAll();
      },
    },
  );

  const formApi: FormApi<F> = {
    values,
    errors,
    disabled: saveAction.loading,
    setValue: (key, value) => setValues((prev) => ({ ...prev, [key]: value })),
    setError: (key, message) => setErrors((prev) => ({ ...prev, [key]: message })),
  };

  const loadWarnIds = config.assign.loadWarnIds;

  return (
    <Screen
      title={config.title}
      large
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      right={<Button title={config.addLabel} icon="plus" size="sm" onPress={() => openForm(null)} testID="template-add" />}
      testID={`payroll-${config.kind}`}
    >
      <SectionHeader title={config.listLabel} />

      {query.isLoading ? <SkeletonList count={3} /> : null}
      {!query.isLoading && query.isError ? (
        <ErrorState message="Failed to load templates" onRetry={() => void query.refetch()} />
      ) : null}
      {!query.isLoading && !query.isError && items.length === 0 ? (
        <EmptyState
          icon={config.icon}
          title="Nothing here yet"
          message="Add your first template to get started."
          action={{ label: config.addLabel, onPress: () => openForm(null), icon: 'plus' }}
        />
      ) : null}

      {items.length > 0 ? (
        <View style={{ marginTop: spacing.sm }}>
          <ResponsiveRow columns={{ phone: 1, tablet: 2, desktop: 2 }}>
            {items.map((item, index) => (
              <TemplateCard
                key={item.id}
                testID={`template-${item.id}`}
                icon={config.icon}
                title={config.itemTitle(item, index)}
                badges={config.renderBadges(item)}
                details={config.renderDetails?.(item)}
                assignedCount={item.assignedCount}
                menuOpen={menuId === item.id}
                confirmingDelete={confirmId === item.id}
                deleting={deleteAction.loading && confirmId === item.id}
                canDelete={deletableId === item.id}
                deleteConfirmText={config.deleteConfirm}
                onToggleMenu={() => {
                  setConfirmId(null);
                  setMenuId((current) => (current === item.id ? null : item.id));
                }}
                onEdit={() => openForm(item)}
                onAssign={() => {
                  setMenuId(null);
                  setAssignId(item.id);
                }}
                onAskDelete={() => setConfirmId(item.id)}
                onCancelDelete={() => setConfirmId(null)}
                onConfirmDelete={() => void deleteAction.run(item.id)}
              />
            ))}
          </ResponsiveRow>
        </View>
      ) : null}

      <TemplateFormModal
        visible={formOpen}
        title={config.formTitle(editing, nextName)}
        saving={saveAction.loading}
        dismissible={config.formDismissible}
        onCancel={closeForm}
        onSubmit={submit}
      >
        {config.fields(formApi)}
      </TemplateFormModal>

      <AssignStaffModal
        visible={assignItem !== null}
        onClose={() => setAssignId(null)}
        orgId={orgId}
        kind={config.kind}
        templateId={assignItem?.id ?? null}
        title={config.assign.title}
        hint={config.assign.hint}
        listStaff={config.api.listStaff}
        assign={config.api.assign}
        unassign={config.api.unassign}
        loadWarnIds={loadWarnIds ? () => loadWarnIds(orgId, items) : undefined}
        warnTitle={config.assign.warnTitle}
        warnMessage={config.assign.warnMessage}
      />
    </Screen>
  );
}
