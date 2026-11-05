import React, { useCallback, useState } from 'react';
import { BackHandler, Platform, Pressable, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Screen } from '@/components/layout';
import { Avatar, BottomSheet, Button, Card, ErrorState, Icon, ListItem, Modal, Skeleton, Text, TextField } from '@/components/ui';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { routes, useAppRouter } from '@/lib/navigation';
import { radii, spacing, useTheme } from '@/theme';

import { InfoRow, SectionCard } from '../components/PersonalFields';
import { usePersonalDetailsEditor } from '../hooks/usePersonalDetailsEditor';
import { SECTIONS } from '../utils/personalDetails';

/** Personal details: view and edit profile, identity and bank details, with photo upload and an unsaved-changes guard. */
export default function PersonalDetailsScreen() {
  const { colors } = useTheme();
  const router = useAppRouter();
  const { isDesktop } = useBreakpoint();
  const ed = usePersonalDetailsEditor();
  const [guardOpen, setGuardOpen] = useState(false);
  const [photoSheet, setPhotoSheet] = useState(false);

  const leave = useCallback(() => router.backOr(routes.staff.home), [router]);
  const handleBack = useCallback(() => {
    if (ed.dirty) setGuardOpen(true);
    else leave();
  }, [ed.dirty, leave]);

  // Android hardware back follows the same guard (registered only while the screen is focused).
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!ed.dirty) return false;
        setGuardOpen(true);
        return true;
      });
      return () => sub.remove();
    }, [ed.dirty]),
  );

  const onCancel = () => {
    if (ed.dirty) setGuardOpen(true);
    else ed.discard();
  };

  const exit = () => {
    setGuardOpen(false);
    ed.discard();
    leave();
  };
  const saveFromGuard = async () => {
    setGuardOpen(false);
    await ed.save();
  };

  const d = ed.details;
  const shown = ed.isEdit ? ed.draft : ed.saved;
  const photoUri = ed.photo?.uri ?? d?.photoUrl;
  const loading = ed.query.isPending && !d;

  const hero = (
    <Card style={{ gap: spacing.lg }} testID="profile-hero">
      <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ed.isEdit ? 'Change profile photo' : 'Profile photo'}
          disabled={!ed.isEdit}
          onPress={() => setPhotoSheet(true)}
          testID="profile-photo"
        >
          <Avatar uri={photoUri} name={shown.name || '?'} size={84} />
          {ed.isEdit ? (
            <View style={{ position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="camera" size={16} color="onPrimary" />
            </View>
          ) : null}
        </Pressable>
        <View style={{ flex: 1 }}>
          {ed.isEdit ? (
            <TextField label="Name" value={ed.draft.name} onChangeText={(t) => ed.setField('name', t)} placeholder="Enter name" testID="field-name" />
          ) : (
            <>
              <Text variant="micro" color="textMuted">
                NAME
              </Text>
              <Text variant="title2" numberOfLines={2} testID="profile-name">
                {shown.name || '—'}
              </Text>
            </>
          )}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.md }}>
          <InfoRow label="Branch" value={d?.branchName ?? ''} testID="profile-branch" />
        </View>
        <View style={{ flex: 1, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.md }}>
          <InfoRow label="Employee ID" value={d?.empId ?? ''} testID="profile-empid" />
        </View>
      </View>
    </Card>
  );

  const sections = SECTIONS.map((section) => (
    <SectionCard key={section.key} section={section} isEdit={ed.isEdit} draft={shown} errors={ed.errors} onChange={ed.setField} onPick={ed.setDraftValue} />
  ));

  return (
    <Screen
      title="Personal Details"
      onBack={handleBack}
      right={
        d ? (
          ed.isEdit ? (
            <Button title="Cancel" variant="ghost" size="sm" onPress={onCancel} testID="profile-cancel" />
          ) : (
            <Button title="Edit" variant="secondary" size="sm" icon="edit" onPress={ed.startEdit} testID="profile-edit" />
          )
        ) : undefined
      }
      footer={
        ed.isEdit ? <Button title="Save Changes" onPress={() => void ed.save()} loading={ed.saving} disabled={ed.saving} fullWidth size="lg" testID="profile-save" /> : undefined
      }
      refreshing={ed.query.isRefetching && !ed.isEdit}
      onRefresh={ed.isEdit ? undefined : () => void ed.query.refetch()}
      testID="profile-screen"
    >
      {loading ? (
        <View style={{ gap: spacing.lg }} testID="profile-loading">
          <Skeleton height={150} />
          <Skeleton height={260} />
        </View>
      ) : ed.query.isError && !d ? (
        <ErrorState message="Could not load your details." onRetry={() => void ed.query.refetch()} />
      ) : (
        <View style={{ gap: spacing.lg }}>
          {hero}
          {isDesktop ? (
            <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>{sections[0]}</View>
              <View style={{ flex: 1, gap: spacing.lg }}>
                {sections[1]}
                {sections[2]}
              </View>
            </View>
          ) : (
            sections
          )}
        </View>
      )}

      <Modal
        visible={guardOpen}
        onClose={() => setGuardOpen(false)}
        size="sm"
        title="Unsaved Changes"
        footer={
          <View style={{ gap: spacing.sm, paddingBottom: spacing.xs }}>
            <Button title="Save" onPress={() => void saveFromGuard()} fullWidth testID="guard-save" />
            <Button title="Exit" variant="danger" onPress={exit} fullWidth testID="guard-exit" />
            <Button title="Keep editing" variant="ghost" onPress={() => setGuardOpen(false)} fullWidth testID="guard-stay" />
          </View>
        }
      >
        <View style={{ alignItems: 'center', gap: spacing.md }}>
          <Icon name="alert" size={36} color="warning" />
          <Text variant="body" align="center">
            You have unsaved changes. Do you want to save before leaving?
          </Text>
        </View>
      </Modal>

      <Modal visible={ed.showSaved} onClose={ed.closeSaved} size="sm">
        <View style={{ alignItems: 'center', gap: spacing.md }} testID="saved-modal">
          <Icon name="check-circle" size={48} color="success" />
          <Text variant="title2">Saved!</Text>
          <Text variant="body" color="textSecondary" align="center">
            Personal details updated successfully
          </Text>
        </View>
      </Modal>

      <BottomSheet visible={photoSheet} onClose={() => setPhotoSheet(false)} title="Profile photo" snap="auto">
        <View>
          <ListItem
            icon="camera"
            title="Take Photo"
            onPress={() => {
              setPhotoSheet(false);
              void ed.choosePhoto('camera');
            }}
            divider
          />
          <ListItem
            icon="image"
            title="Choose from Gallery"
            onPress={() => {
              setPhotoSheet(false);
              void ed.choosePhoto('library');
            }}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}
