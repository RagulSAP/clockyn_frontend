import React from 'react';
import { Text as RNText } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import {
  Calendar,
  DataTable,
  EmptyState,
  ErrorState,
  FAB,
  ListItem,
  RefreshableList,
  RefreshableScroll,
  SectionHeader,
  StatCard,
  Text,
} from '@/components/ui';
import { countHostType, renderThemed } from '../testing/testUtils';

describe('ListItem / SectionHeader / StatCard', () => {
  it('ListItem renders title, subtitle, right and handles press', async () => {
    const onPress = jest.fn();
    await renderThemed(<ListItem title="Staff" subtitle="42 active" right={<Text>R</Text>} onPress={onPress} />);
    expect(screen.getByText('42 active')).toBeTruthy();
    await fireEvent.press(screen.getByText('Staff'));
    expect(onPress).toHaveBeenCalled();
  });

  it('SectionHeader action fires', async () => {
    const onPress = jest.fn();
    await renderThemed(<SectionHeader title="Recent" action={{ label: 'See all', onPress }} />);
    await fireEvent.press(screen.getByText('See all'));
    expect(onPress).toHaveBeenCalled();
  });

  it('StatCard shows label, value, trend and loading skeleton', async () => {
    await renderThemed(
      <>
        <StatCard label="Present" value={42} icon="users" trend={{ value: '+6%', direction: 'up' }} />
        <StatCard label="Loading" value="-" loading />
      </>,
    );
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('+6%')).toBeTruthy();
  });
});

describe('EmptyState / ErrorState', () => {
  it('EmptyState action works', async () => {
    const onPress = jest.fn();
    await renderThemed(<EmptyState title="Nothing" message="Add one" action={{ label: 'Add', onPress }} />);
    await fireEvent.press(screen.getByText('Add'));
    expect(onPress).toHaveBeenCalled();
  });

  it('ErrorState shows the message and retries', async () => {
    const onRetry = jest.fn();
    await renderThemed(<ErrorState message="Network down" onRetry={onRetry} />);
    expect(screen.getByText('Network down')).toBeTruthy();
    await fireEvent.press(screen.getByText('Try again'));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('Calendar', () => {
  it('renders every day of the month and reports presses', async () => {
    const onDayPress = jest.fn();
    await renderThemed(
      <Calendar month={10} year={2026} onMonthChange={() => {}} onDayPress={onDayPress} markedDates={{ '2026-10-05': { color: '#12A168', label: 'P' } }} />,
    );
    expect(screen.getByText('31')).toBeTruthy();
    expect(screen.queryByText('32')).toBeNull();
    expect(screen.getByText('P')).toBeTruthy();
    await fireEvent.press(screen.getByText('15'));
    expect(onDayPress).toHaveBeenCalledWith('2026-10-15');
  });

  it('does not report disabled days', async () => {
    const onDayPress = jest.fn();
    await renderThemed(<Calendar month={10} year={2026} onMonthChange={() => {}} onDayPress={onDayPress} minDate="2026-10-10" />);
    await fireEvent.press(screen.getByText('3'));
    expect(onDayPress).not.toHaveBeenCalled();
  });

  it('supports Monday-first weeks and custom day rendering', async () => {
    await renderThemed(
      <Calendar month={10} year={2026} onMonthChange={() => {}} weekStartsOn={1} renderDay={(d) => <RNText>{`d${d.day}`}</RNText>} />,
    );
    expect(screen.getByText('d1')).toBeTruthy();
    expect(screen.getAllByText('MON').length).toBe(1);
  });
});

describe('DataTable', () => {
  type R = { id: string; name: string; qty: number };
  const rows: R[] = [
    { id: '1', name: 'Asha', qty: 3 },
    { id: '2', name: 'Rahul', qty: 5 },
  ];
  const columns = [
    { key: 'name', title: 'Name', width: 140 },
    { key: 'qty', title: 'Qty', width: 80, align: 'right' as const, render: (r: R) => <Text>{`x${r.qty}`}</Text> },
  ];

  it('renders headers, groups, frozen column and custom cells', async () => {
    await renderThemed(<DataTable<R> columns={columns} rows={rows} rowKey="id" headerGroups={[{ title: 'Info', span: 2 }]} />);
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('INFO')).toBeTruthy();
    expect(screen.getByText('Asha')).toBeTruthy();
    expect(screen.getByText('x5')).toBeTruthy();
  });

  it('fires onRowPress with the row', async () => {
    const onRowPress = jest.fn();
    await renderThemed(<DataTable<R> columns={columns} rows={rows} rowKey={(r) => r.id} onRowPress={onRowPress} />);
    await fireEvent.press(screen.getByText('Rahul'));
    expect(onRowPress).toHaveBeenCalledWith(rows[1], 1);
  });

  it('shows the empty text and a bounded scroll area when maxHeight is set', async () => {
    await renderThemed(<DataTable<R> columns={columns} rows={[]} rowKey="id" emptyText="Nothing to show" maxHeight={300} />);
    expect(screen.getByText('Nothing to show')).toBeTruthy();
  });

  it('does not render rows or the empty text while loading', async () => {
    await renderThemed(<DataTable<R> columns={columns} rows={rows} rowKey="id" loading emptyText="Nothing" />);
    expect(screen.queryByText('Asha')).toBeNull();
    expect(screen.queryByText('Nothing')).toBeNull();
  });
});

describe('FAB / Refreshable', () => {
  it('FAB fires onPress and uses the label for accessibility', async () => {
    const onPress = jest.fn();
    await renderThemed(<FAB icon="plus" label="New" onPress={onPress} />);
    await fireEvent.press(screen.getByLabelText('New'));
    expect(onPress).toHaveBeenCalled();
  });

  it('RefreshableScroll / RefreshableList wire a RefreshControl', async () => {
    const onRefresh = jest.fn();
    await renderThemed(
      <>
        <RefreshableScroll refreshing={false} onRefresh={onRefresh} testID="rs">
          <Text>child</Text>
        </RefreshableScroll>
        <RefreshableList refreshing data={['a']} renderItem={({ item }) => <Text>{item}</Text>} onRefresh={onRefresh} testID="rl" />
      </>,
    );
    expect(countHostType(screen.toJSON() as never, 'RCTRefreshControl')).toBe(2);
    expect(screen.getByText('child')).toBeTruthy();
  });
});
