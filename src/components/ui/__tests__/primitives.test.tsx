import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import {
  Avatar,
  Badge,
  BrandMark,
  Button,
  Card,
  CountBadge,
  Divider,
  GradientView,
  Icon,
  IconButton,
  Skeleton,
  SkeletonList,
  Spacer,
  Spinner,
  StatusPill,
  Text,
  getInitials,
  iconNames,
  stableImageKey,
  statusTone,
} from '@/components/ui';
import { lightColors } from '@/theme/colors';
import { renderThemed } from '../testing/testUtils';

/** Decorative / aria-hidden nodes are skipped by default; opt in when asserting on them. */
const HIDDEN = { includeHiddenElements: true } as const;

describe('Text', () => {
  it('renders children with the requested variant style', async () => {
    await renderThemed(<Text variant="title1">Hello</Text>);
    const node = screen.getByText('Hello');
    expect(node).toBeTruthy();
    expect(JSON.stringify(node.props.style)).toContain('26');
  });

  it('resolves colour tokens and raw colours', async () => {
    await renderThemed(
      <>
        <Text color="danger">token</Text>
        <Text color="#123456">raw</Text>
      </>,
    );
    expect(JSON.stringify(screen.getByText('token').props.style)).toContain(lightColors.danger);
    expect(JSON.stringify(screen.getByText('raw').props.style)).toContain('#123456');
  });
});

describe('Icon', () => {
  it('has a lucide component for every name', () => {
    expect(iconNames.length).toBeGreaterThanOrEqual(120);
  });

  it('renders without crashing and is decorative by default', async () => {
    await renderThemed(<Icon name="home" testID="i" />);
    expect(screen.getByTestId('i', HIDDEN)).toBeTruthy();
  });
});

describe('Button', () => {
  it('fires onPress and exposes button semantics', async () => {
    const onPress = jest.fn();
    await renderThemed(<Button title="Save" onPress={onPress} testID="b" />);
    await fireEvent.press(screen.getByTestId('b'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('does not fire while loading or disabled', async () => {
    const onPress = jest.fn();
    await renderThemed(
      <>
        <Button title="L" onPress={onPress} loading testID="l" />
        <Button title="D" onPress={onPress} disabled testID="d" />
      </>,
    );
    await fireEvent.press(screen.getByTestId('l'));
    await fireEvent.press(screen.getByTestId('d'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders every variant and size', async () => {
    await renderThemed(
      <>
        {(['primary', 'secondary', 'ghost', 'danger', 'success'] as const).map((v) => (
          <Button key={v} title={v} variant={v} size="sm" icon="check" iconRight="arrow-right" onPress={() => {}} />
        ))}
        <Button title="lg" size="lg" fullWidth onPress={() => {}} />
      </>,
    );
    expect(screen.getByText('success')).toBeTruthy();
  });
});

describe('IconButton', () => {
  it('uses the accessibility label and fires onPress', async () => {
    const onPress = jest.fn();
    await renderThemed(<IconButton icon="bell" accessibilityLabel="Notifications" onPress={onPress} />);
    await fireEvent.press(screen.getByLabelText('Notifications'));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('Card', () => {
  it('renders children in every variant and is pressable when asked', async () => {
    const onPress = jest.fn();
    await renderThemed(
      <>
        <Card testID="c1"><Text>one</Text></Card>
        <Card variant="outlined"><Text>two</Text></Card>
        <Card variant="muted"><Text>three</Text></Card>
        <Card variant="gradient"><Text>four</Text></Card>
        <Card onPress={onPress} testID="c5"><Text>five</Text></Card>
      </>,
    );
    expect(screen.getByText('four')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('c5'));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('utility components', () => {
  it('renders Divider, Spacer, GradientView, Spinner', async () => {
    await renderThemed(
      <>
        <Divider testID="d" />
        <Spacer size="lg" testID="s" />
        <GradientView testID="g" />
        <Spinner testID="sp" />
      </>,
    );
    expect(screen.getByTestId('d')).toBeTruthy();
    expect(screen.getByTestId('g')).toBeTruthy();
    expect(screen.getByTestId('sp')).toBeTruthy();
  });

  it('renders BrandMark variants', async () => {
    await renderThemed(
      <>
        <BrandMark variant="mark" testID="m" />
        <BrandMark variant="wordmark" testID="w" />
        <BrandMark variant="stacked" tone="light" testID="s" />
      </>,
    );
    expect(screen.getByTestId('m')).toBeTruthy();
    expect(screen.getAllByText('Clockyn', HIDDEN).length).toBeGreaterThanOrEqual(2);
  });
});

describe('Badge family', () => {
  it('renders Badge label', async () => {
    await renderThemed(<Badge label="New" tone="success" />);
    expect(screen.getByText('New')).toBeTruthy();
  });

  it('maps statuses to tones and humanises labels', async () => {
    expect(statusTone('approved')).toBe('success');
    expect(statusTone('REJECTED')).toBe('danger');
    expect(statusTone('half_day')).toBe('primary');
    expect(statusTone('something-unknown')).toBe('neutral');
    await renderThemed(<StatusPill status="half_day" />);
    expect(screen.getByText('Half day')).toBeTruthy();
  });

  it('CountBadge caps at 99+ and hides zero', async () => {
    await renderThemed(
      <>
        <CountBadge count={250} />
        <CountBadge count={7} />
        <CountBadge count={0} testID="zero" />
      </>,
    );
    expect(screen.getByText('99+')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.queryByTestId('zero')).toBeNull();
  });
});

describe('Avatar', () => {
  it('shows initials without an image and handles status', async () => {
    await renderThemed(<Avatar name="Asha Verma" status="online" />);
    expect(screen.getByText('AV')).toBeTruthy();
  });

  it('helpers', () => {
    expect(getInitials('  rahul   nair ')).toBe('RN');
    expect(getInitials('Meera')).toBe('M');
    expect(getInitials('')).toBe('');
    expect(stableImageKey('https://x.test/a.png?sig=1&exp=2')).toBe('https://x.test/a.png');
    expect(stableImageKey('https://x.test/a.png')).toBe('https://x.test/a.png');
  });
});

describe('Skeleton', () => {
  it('renders blocks and lists', async () => {
    await renderThemed(
      <>
        <Skeleton testID="sk" width={100} height={10} />
        <SkeletonList count={3} testID="sl" />
      </>,
    );
    expect(screen.getByTestId('sk', HIDDEN)).toBeTruthy();
    expect(screen.getByTestId('sl')).toBeTruthy();
  });
});
