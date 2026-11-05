import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { spacing } from '@/theme';
import { Card, SectionHeader, Text } from '@/components/ui';

export type SectionProps = {
  title?: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
  children?: React.ReactNode;
  /** Space between the heading and content, and between children (default 12). */
  gap?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Titled block of content with consistent vertical rhythm. Stack sections with a `gap` on the parent. */
export function Section({ title, subtitle, action, children, gap = spacing.md, style, testID }: SectionProps) {
  return (
    <View testID={testID} style={[{ gap }, style]}>
      {title ? <SectionHeader title={title} subtitle={subtitle} action={action} /> : null}
      {children}
    </View>
  );
}

export type FormSectionProps = {
  title?: string;
  description?: string;
  children?: React.ReactNode;
  /** Render on a card (default) or flat on the page background. */
  flat?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Group of related form fields with a heading, optional helper text and even spacing. */
export function FormSection({ title, description, children, flat, style, testID }: FormSectionProps) {
  const content = (
    <View style={{ gap: spacing.lg }}>
      {title || description ? (
        <View style={{ gap: 2 }}>
          {title ? (
            <Text variant="title3" accessibilityRole="header">
              {title}
            </Text>
          ) : null}
          {description ? (
            <Text variant="callout" color="textSecondary">
              {description}
            </Text>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
  if (flat) return <View testID={testID} style={style}>{content}</View>;
  return (
    <Card testID={testID} padding={spacing.lg} style={style}>
      {content}
    </Card>
  );
}
