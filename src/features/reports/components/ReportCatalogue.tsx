import React from 'react';
import { Pressable, View } from 'react-native';
import { ResponsiveRow } from '@/components/layout';
import { Card, Icon, Text, toneColors } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';
import { useAppRouter } from '@/lib/navigation';
import { REPORT_CATALOGUE, routeFor, type CatalogueCategory, type HubVariant } from '../utils/catalogue';

function CategoryCard({ category, variant }: { category: CatalogueCategory; variant: HubVariant }) {
  const { colors } = useTheme();
  const router = useAppRouter();
  // Category colour-coding is decorative: keep the hub monochrome (colour is reserved for meaning).
  const tone = toneColors('primary', colors);
  return (
    <Card padding={0} style={{ flex: 1 }} testID={`category-${category.title}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg }}>
        <View style={{ width: 40, height: 40, borderRadius: radii.md, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={category.icon} size={20} color={tone.fg} />
        </View>
        <Text variant="title3" accessibilityRole="header">
          {category.title}
        </Text>
      </View>
      {category.rows.map((row, i) => {
        const route = routeFor(row, variant);
        const enabled = route !== undefined;
        return (
          <Pressable
            key={row.label}
            disabled={!enabled}
            onPress={route ? () => router.push(route) : undefined}
            accessibilityRole="button"
            accessibilityState={{ disabled: !enabled }}
            accessibilityLabel={row.label}
            testID={`report-row-${row.label}`}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              minHeight: 48,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: pressed && enabled ? colors.primarySoft : 'transparent',
              borderBottomLeftRadius: i === category.rows.length - 1 ? radii.lg : 0,
              borderBottomRightRadius: i === category.rows.length - 1 ? radii.lg : 0,
            })}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: enabled ? tone.fg : colors.borderStrong }} />
            <Text variant="body" color={enabled ? 'text' : 'textMuted'} style={{ flex: 1 }}>
              {row.label}
            </Text>
            {enabled ? <Icon name="chevron-right" size={18} color="textMuted" /> : null}
          </Pressable>
        );
      })}
    </Card>
  );
}

/** The categorised report links. Rows without a route are greyed placeholders. */
export function ReportCatalogue({ variant }: { variant: HubVariant }) {
  return (
    <ResponsiveRow columns={{ phone: 1, tablet: 2, desktop: 2 }} gap={spacing.lg}>
      {REPORT_CATALOGUE.map((category) => (
        <CategoryCard key={category.title} category={category} variant={variant} />
      ))}
    </ResponsiveRow>
  );
}
