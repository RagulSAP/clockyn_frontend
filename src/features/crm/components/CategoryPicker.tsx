import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  BottomSheet,
  Button,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  ListItem,
  Modal,
  SearchBar,
  Spinner,
  Text,
  TextField,
  useConfirm,
  useToast,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { radii, spacing, useTheme } from '@/theme';

import { useAddCategory, useDeleteCategory, useLeadCategories } from '../hooks/useLeadCategories';
import { filterCategories } from '../utils/categories';

export interface CategoryPickerProps {
  /** Selected category name ('' = none). */
  value: string;
  onChange: (name: string) => void;
  error?: string | null;
  /** Admin form: categories can be deleted from the list (with confirmation). The staff sheet cannot delete. */
  allowDelete?: boolean;
  disabled?: boolean;
}

/**
 * Category field: pick (with search), add a new category (auto-selected) and - for admins - delete a category.
 * Deleting asks for confirmation and clears the field when the selected category is the one removed (v1 deleted
 * instantly and left a stale selection behind).
 */
export function CategoryPicker({ value, onChange, error, allowDelete, disabled }: CategoryPickerProps) {
  const { colors } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const categories = useLeadCategories();
  const add = useAddCategory();
  const remove = useDeleteCategory();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const filtered = useMemo(() => filterCategories(categories.data ?? [], search), [categories.data, search]);

  const submitNew = async () => {
    if (newName.trim() === '') {
      toast.error('Please enter category name');
      return;
    }
    try {
      const created = await add.mutateAsync(newName);
      onChange(created.name);
      setNewName('');
      setAddOpen(false);
    } catch {
      // the mutation toasted the server message; the dialog stays open
    }
  };

  const deleteCategory = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Delete category?',
      message: `"${name}" will be removed from the category list.`,
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(id);
      if (name === value) onChange('');
    } catch {
      // toasted by the mutation
    }
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text variant="callout" weight="semibold" color="textSecondary">
          Category
          <Text variant="callout" weight="semibold" color="danger">
            {' *'}
          </Text>
        </Text>
        <Button
          title="Add"
          icon="plus"
          size="sm"
          variant="ghost"
          disabled={disabled}
          onPress={() => setAddOpen(true)}
          testID="crm-category-add"
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Category"
        disabled={disabled}
        onPress={() => setOpen(true)}
        testID="crm-category-trigger"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 50,
          paddingHorizontal: spacing.lg,
          borderRadius: radii.md,
          borderWidth: 1.5,
          borderColor: error ? colors.danger : colors.border,
          backgroundColor: colors.surface,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Text variant="body" color={value ? 'text' : 'textMuted'} numberOfLines={1} style={{ flex: 1 }}>
          {value || 'Select Category'}
        </Text>
        <Icon name="chevron-down" size={18} color="textMuted" />
      </Pressable>
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}

      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Select Category" snap="half">
        <View style={{ gap: spacing.md, minHeight: 240 }}>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search categories..." />
          {categories.isLoading ? (
            <View style={{ padding: spacing.xl, alignItems: 'center' }}>
              <Spinner />
            </View>
          ) : categories.isError && !categories.data ? (
            <ErrorState
              compact
              message={getErrorMessage(categories.error, 'Failed to load categories')}
              onRetry={() => void categories.refetch()}
              testID="crm-category-error"
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              compact
              icon="tag"
              title="No categories"
              message={search ? 'No category matches your search.' : 'Add your first category.'}
            />
          ) : (
            filtered.map((c) => (
              <ListItem
                key={c.id}
                title={c.name}
                divider
                onPress={() => {
                  onChange(c.name);
                  setSearch('');
                  setOpen(false);
                }}
                right={
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {c.name === value ? <Icon name="check" size={18} color="primary" /> : null}
                    {allowDelete ? (
                      <IconButton
                        icon="x"
                        size="sm"
                        color="danger"
                        accessibilityLabel={`Delete category ${c.name}`}
                        onPress={() => void deleteCategory(c.id, c.name)}
                      />
                    ) : null}
                  </View>
                }
              />
            ))
          )}
        </View>
      </BottomSheet>

      <Modal
        visible={addOpen}
        onClose={() => {
          setAddOpen(false);
          setNewName('');
        }}
        title="Add New Category"
        size="sm"
        footer={
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              gap: spacing.sm,
            }}
          >
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => {
                setAddOpen(false);
                setNewName('');
              }}
            />
            <Button title="Add" loading={add.isPending} onPress={() => void submitNew()} testID="crm-category-add-confirm" />
          </View>
        }
      >
        <TextField
          label="Category name"
          value={newName}
          onChangeText={setNewName}
          placeholder="Enter category name"
          autoFocus
          onSubmitEditing={() => void submitNew()}
        />
      </Modal>
    </View>
  );
}
