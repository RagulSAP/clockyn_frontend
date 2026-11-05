import React from 'react';
import { Text as RNText } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { FormSection, Section } from '@/components/layout/Section';
import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer';
import { ResponsiveRow } from '@/components/layout/ResponsiveRow';
import { getBreakpoint } from '@/hooks/useBreakpoint';
import { Button } from '@/components/ui';
import { countHostType, renderThemed } from '../testing/testUtils';

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;
jest.mock('expo-router', () => ({
  router: {
    back: (...a: unknown[]) => mockBack(...a),
    replace: (...a: unknown[]) => mockReplace(...a),
    canGoBack: () => mockCanGoBack,
  },
}));

describe('useBreakpoint', () => {
  it('classifies widths at the token breakpoints', () => {
    expect(getBreakpoint(360)).toMatchObject({ isPhone: true, isTablet: false, isDesktop: false, isWide: false });
    expect(getBreakpoint(767).isPhone).toBe(true);
    expect(getBreakpoint(768)).toMatchObject({ isPhone: false, isTablet: true, isWide: true });
    expect(getBreakpoint(1099).isTablet).toBe(true);
    expect(getBreakpoint(1100)).toMatchObject({ isDesktop: true, isTablet: false, isWide: true });
  });
});

describe('Screen', () => {
  it('renders title, content and a footer', async () => {
    await renderThemed(
      <Screen title="Settings" footer={<Button title="Save" onPress={() => {}} />}>
        <RNText>content</RNText>
      </Screen>,
    );
    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('content')).toBeTruthy();
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('back button calls router.back by default and a custom onBack when given', async () => {
    mockBack.mockClear();
    const { rerender } = await renderThemed(
      <Screen title="Detail">
        <RNText>x</RNText>
      </Screen>,
    );
    await fireEvent.press(screen.getByLabelText('Go back'));
    expect(mockBack).toHaveBeenCalledTimes(1);

    const onBack = jest.fn();
    await rerender(
      <Screen title="Detail" onBack={onBack}>
        <RNText>x</RNText>
      </Screen>,
    );
    await fireEvent.press(screen.getByLabelText('Go back'));
    expect(onBack).toHaveBeenCalled();
  });

  it('without history (reload / deep link) the back button is still offered and falls back to the root redirect', async () => {
    mockCanGoBack = false;
    mockBack.mockClear();
    mockReplace.mockClear();
    try {
      await renderThemed(
        <Screen title="Detail">
          <RNText>body</RNText>
        </Screen>,
      );
      await fireEvent.press(screen.getByLabelText('Go back'));
      expect(mockBack).not.toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/');
    } finally {
      mockCanGoBack = true;
    }
  });

  it('hideBack removes the back button', async () => {
    await renderThemed(
      <Screen title="Home" hideBack>
        <RNText>x</RNText>
      </Screen>,
    );
    expect(screen.queryByLabelText('Go back')).toBeNull();
  });

  it('non-scrolling screens and overlays render', async () => {
    await renderThemed(
      <Screen scroll={false} overlay={<RNText>floating</RNText>} edges={['top']}>
        <RNText>fixed</RNText>
      </Screen>,
    );
    expect(screen.getByText('fixed')).toBeTruthy();
    expect(screen.getByText('floating')).toBeTruthy();
  });

  it('wires pull-to-refresh on native', async () => {
    const onRefresh = jest.fn();
    await renderThemed(
      <Screen title="List" onRefresh={onRefresh} refreshing={false}>
        <RNText>x</RNText>
      </Screen>,
    );
    expect(countHostType(screen.toJSON() as never, 'RCTRefreshControl')).toBe(1);
  });
});

describe('ScreenHeader / Section / containers', () => {
  it('ScreenHeader renders title, subtitle and right actions', async () => {
    await renderThemed(<ScreenHeader title="Team" subtitle="42 members" right={<RNText>act</RNText>} onBack={() => {}} />);
    expect(screen.getByText('Team')).toBeTruthy();
    expect(screen.getByText('42 members')).toBeTruthy();
    expect(screen.getByText('act')).toBeTruthy();
  });

  it('large ScreenHeader renders', async () => {
    await renderThemed(<ScreenHeader title="Home" large />);
    expect(screen.getByText('Home')).toBeTruthy();
  });

  it('Section and FormSection render headings and children', async () => {
    await renderThemed(
      <>
        <Section title="Recent" action={{ label: 'All', onPress: () => {} }}>
          <RNText>row</RNText>
        </Section>
        <FormSection title="Details" description="Fill in">
          <RNText>field</RNText>
        </FormSection>
      </>,
    );
    expect(screen.getByText('Recent')).toBeTruthy();
    expect(screen.getByText('Fill in')).toBeTruthy();
    expect(screen.getByText('field')).toBeTruthy();
  });

  it('ResponsiveContainer caps width; ResponsiveRow wraps every child', async () => {
    await renderThemed(
      <>
        <ResponsiveContainer maxWidth={500} testID="rc">
          <RNText>inside</RNText>
        </ResponsiveContainer>
        <ResponsiveRow columns={2}>
          <RNText>a</RNText>
          <RNText>b</RNText>
          <RNText>c</RNText>
        </ResponsiveRow>
      </>,
    );
    expect(JSON.stringify(screen.getByTestId('rc').props.style)).toContain('500');
    expect(screen.getByText('c')).toBeTruthy();
  });
});
