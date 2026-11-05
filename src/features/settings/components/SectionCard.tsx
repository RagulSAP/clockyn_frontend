import React from 'react';
import { Pressable, View } from 'react-native';

import { Card, Icon, ListItem, Text } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

import { isMenuGroup, type MenuChild, type MenuLeaf, type MenuSection } from '../utils/settingsMenu';

export type SectionCardProps = {
  section: MenuSection;
  /** Overrides the section subtitle (e.g. "Upgrade plan to access"). */
  subtitle?: string;
  /** Accordion only: open state. */
  open?: boolean;
  /** Header press: toggles an accordion, navigates a link row, or shows the gate toast. */
  onPress: () => void;
  /** Accordion children (rendered only while open). */
  children?: React.ReactNode;
};

/** One row of the hub: icon tile, title, subtitle and a chevron that shows the open state. */
export function SectionCard({ section, subtitle, open, onPress, children }: SectionCardProps) {
  return (
    <Card padding={0} testID={`section-${section.id}`}>
      {/* clips the row hover / pressed tint to the card's rounded corners */}
      <View style={{ borderRadius: radii.lg, overflow: 'hidden' }}>
        <ListItem
          icon={section.icon}
          title={section.title}
          subtitle={subtitle ?? section.subtitle}
          onPress={onPress}
          right={<Icon name={open ? 'chevron-down' : 'chevron-right'} size={18} color="textMuted" />}
          accessibilityLabel={`${section.title}. ${subtitle ?? section.subtitle}`}
          testID={`section-header-${section.id}`}
        />
      </View>
      {open && children ? <ChildrenBox>{children}</ChildrenBox> : null}
    </Card>
  );
}

function ChildrenBox({ children, nested }: { children: React.ReactNode; nested?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        marginHorizontal: spacing.md,
        marginBottom: spacing.md,
        marginLeft: nested ? spacing.lg : spacing.md,
        borderRadius: radii.md,
        backgroundColor: colors.surfaceMuted,
        overflow: 'hidden',
        // nested group: a strong hairline spine so it reads as a sub-list of the same-coloured parent box
        ...(nested ? { borderLeftWidth: 2, borderLeftColor: colors.borderStrong } : null),
      }}
    >
      {children}
    </View>
  );
}

function ChildRow({ title, onPress, destructive, trailing, testID }: { title: string; onPress: () => void; destructive?: boolean; trailing?: React.ReactNode; testID: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID={testID}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        minHeight: 48,
        paddingHorizontal: spacing.lg,
        backgroundColor: pressed ? colors.border : 'transparent',
      })}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: destructive ? colors.danger : colors.primary }} />
      <Text variant="body" weight="medium" color={destructive ? 'danger' : 'text'} style={{ flex: 1 }}>
        {title}
      </Text>
      {trailing ?? <Icon name="chevron-right" size={16} color="textMuted" />}
    </Pressable>
  );
}

export type MenuChildrenProps = {
  items: readonly MenuChild[];
  onLeafPress: (leaf: MenuLeaf) => void;
  /** Id of the open nested group (Salary → Incentive / OT / Bonus). */
  openGroupId: string | null;
  onToggleGroup: (id: string) => void;
};

/** Children of an open accordion, including nested groups. */
export function MenuChildren({ items, onLeafPress, openGroupId, onToggleGroup }: MenuChildrenProps) {
  return (
    <>
      {items.map((item) =>
        isMenuGroup(item) ? (
          <View key={item.id}>
            <ChildRow
              title={item.title}
              onPress={() => onToggleGroup(item.id)}
              testID={`group-${item.id}`}
              trailing={<Icon name={openGroupId === item.id ? 'chevron-down' : 'chevron-right'} size={16} color="textMuted" />}
            />
            {openGroupId === item.id ? (
              <ChildrenBox nested>
                {item.children.map((leaf) => (
                  <ChildRow key={leaf.id} title={leaf.title} onPress={() => onLeafPress(leaf)} testID={`item-${leaf.id}`} />
                ))}
              </ChildrenBox>
            ) : null}
          </View>
        ) : (
          <ChildRow
            key={item.id}
            title={item.title}
            destructive={item.action.type === 'logout'}
            onPress={() => onLeafPress(item)}
            testID={`item-${item.id}`}
          />
        ),
      )}
    </>
  );
}
