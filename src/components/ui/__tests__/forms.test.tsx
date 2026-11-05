import React, { useState } from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import {
  Checkbox,
  DateField,
  FilterChips,
  MonthYearPicker,
  MultiSelect,
  OTPInput,
  RadioGroup,
  SearchBar,
  SegmentedControl,
  Select,
  Switch,
  Tabs,
  TextField,
  TimeField,
} from '@/components/ui';
import { formatDisplayDate, formatDisplayTime, parseDateStr, daysInMonth, firstWeekday } from '../internal/dates';
import { renderThemed } from '../testing/testUtils';

describe('TextField', () => {
  it('shows label, error and forwards text changes', async () => {
    const onChangeText = jest.fn();
    await renderThemed(<TextField label="Name" value="" onChangeText={onChangeText} error="Required" required testID="tf" />);
    expect(screen.getByText(/Name/)).toBeTruthy();
    expect(screen.getByText('Required')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('tf'), 'Asha');
    expect(onChangeText).toHaveBeenCalledWith('Asha');
  });

  it('renders prefix and reveals secure text on toggle', async () => {
    await renderThemed(<TextField value="secret" onChangeText={() => {}} prefix="+91" secure testID="tf" />);
    expect(screen.getByText('+91')).toBeTruthy();
    expect(screen.getByTestId('tf').props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByLabelText('Show password'));
    expect(screen.getByTestId('tf').props.secureTextEntry).toBe(false);
  });
});

describe('OTPInput', () => {
  it('keeps digits only and caps at length', async () => {
    const onChange = jest.fn();
    const onComplete = jest.fn();
    await renderThemed(<OTPInput value="" onChange={onChange} onComplete={onComplete} length={4} testID="otp" />);
    await fireEvent.changeText(screen.getByTestId('otp'), '12a3456');
    expect(onChange).toHaveBeenCalledWith('1234');
    expect(onComplete).toHaveBeenCalledWith('1234');
  });

  it('renders the entered digits and error text', async () => {
    await renderThemed(<OTPInput value="42" onChange={() => {}} length={6} error="Invalid code" />);
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('Invalid code')).toBeTruthy();
  });
});

describe('Select / MultiSelect', () => {
  const options = [
    { label: 'Head office', value: 'ho' },
    { label: 'Pune', value: 'pn' },
  ];

  it('shows the selected label and selects from the sheet', async () => {
    const onChange = jest.fn();
    await renderThemed(<Select label="Branch" value="ho" options={options} onChange={onChange} />);
    expect(screen.getByText('Head office')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /Branch/ }));
    await fireEvent.press(await screen.findByText('Pune'));
    expect(onChange).toHaveBeenCalledWith('pn');
  });

  it('shows placeholder when nothing is selected', async () => {
    await renderThemed(<Select value={null} options={options} onChange={() => {}} placeholder="Pick one" />);
    expect(screen.getByText('Pick one')).toBeTruthy();
  });

  it('MultiSelect summarises and toggles values', async () => {
    const onChange = jest.fn();
    await renderThemed(<MultiSelect label="Teams" values={['ho']} options={options} onChange={onChange} />);
    expect(screen.getByText('Head office')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /Teams/ }));
    await fireEvent.press(await screen.findByText('Pune'));
    expect(onChange).toHaveBeenCalledWith(['ho', 'pn']);
  });

  it('MultiSelect shows allSelectedText only when every option is selected', async () => {
    const { rerender } = await renderThemed(<MultiSelect label="Teams" values={['ho', 'pn']} options={options} onChange={() => {}} allSelectedText="All selected" />);
    expect(screen.getByText('All selected')).toBeTruthy();
    await rerender(<MultiSelect label="Teams" values={['ho']} options={options} onChange={() => {}} allSelectedText="All selected" />);
    expect(screen.getByText('Head office')).toBeTruthy();
  });
});

describe('Date / Time / MonthYear', () => {
  it('DateField formats the value for display', async () => {
    await renderThemed(<DateField label="Date" value="2026-10-18" onChange={() => {}} />);
    expect(screen.getByText('18 Oct 2026')).toBeTruthy();
  });

  it('TimeField shows a 12-hour display time', async () => {
    await renderThemed(<TimeField label="Time" value="13:05" onChange={() => {}} />);
    expect(screen.getByText('1:05 PM')).toBeTruthy();
  });

  it('MonthYearPicker steps months across year boundaries', async () => {
    const onChange = jest.fn();
    await renderThemed(<MonthYearPicker month={1} year={2026} onChange={onChange} />);
    expect(screen.getByText('January 2026')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Previous month'));
    expect(onChange).toHaveBeenCalledWith({ month: 12, year: 2025 });
    await fireEvent.press(screen.getByLabelText('Next month'));
    expect(onChange).toHaveBeenCalledWith({ month: 2, year: 2026 });
  });

  it('date helpers', () => {
    expect(parseDateStr('2026-02-30')).toEqual({ year: 2026, month: 2, day: 30 });
    expect(parseDateStr('nope')).toBeNull();
    expect(formatDisplayDate('2026-01-05')).toBe('05 Jan 2026');
    expect(formatDisplayTime('00:00')).toBe('12:00 AM');
    expect(formatDisplayTime('12:30')).toBe('12:30 PM');
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(firstWeekday(2026, 10)).toBe(4); // Thursday
  });
});

describe('Selection controls', () => {
  it('SegmentedControl reports changes', async () => {
    const onChange = jest.fn();
    await renderThemed(<SegmentedControl options={[{ label: 'Day', value: 'd' }, { label: 'Week', value: 'w' }]} value="d" onChange={onChange} />);
    await fireEvent.press(screen.getByText('Week'));
    expect(onChange).toHaveBeenCalledWith('w');
  });

  it('Tabs marks the active tab and shows a capped badge', async () => {
    const onChange = jest.fn();
    await renderThemed(<Tabs tabs={[{ key: 'a', label: 'All' }, { key: 'p', label: 'Pending', badge: 120 }]} active="a" onChange={onChange} />);
    expect(screen.getByText('99+')).toBeTruthy();
    await fireEvent.press(screen.getByText('Pending'));
    expect(onChange).toHaveBeenCalledWith('p');
  });

  it('FilterChips supports single and multiple selection', async () => {
    const single = jest.fn();
    const multi = jest.fn();
    const opts = [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }];
    await renderThemed(
      <>
        <FilterChips options={opts} value="a" onChange={single} />
        <FilterChips multiple options={[{ label: 'X', value: 'x' }, { label: 'Y', value: 'y' }]} value={['x']} onChange={multi} />
      </>,
    );
    await fireEvent.press(screen.getByText('B'));
    expect(single).toHaveBeenCalledWith('b');
    await fireEvent.press(screen.getByText('Y'));
    expect(multi).toHaveBeenCalledWith(['x', 'y']);
    await fireEvent.press(screen.getByText('X'));
    expect(multi).toHaveBeenCalledWith([]);
  });

  it('Switch, Checkbox and RadioGroup toggle', async () => {
    const onSwitch = jest.fn();
    const onCheck = jest.fn();
    const onRadio = jest.fn();
    await renderThemed(
      <>
        <Switch label="Notify" value={false} onValueChange={onSwitch} />
        <Checkbox label="Agree" checked={false} onChange={onCheck} />
        <RadioGroup value="m" onChange={onRadio} options={[{ label: 'Monthly', value: 'm' }, { label: 'Yearly', value: 'y' }]} />
      </>,
    );
    await fireEvent.press(screen.getByRole('switch'));
    expect(onSwitch).toHaveBeenCalledWith(true);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Agree' }));
    expect(onCheck).toHaveBeenCalledWith(true);
    await fireEvent.press(screen.getByText('Yearly'));
    expect(onRadio).toHaveBeenCalledWith('y');
  });

  it('SearchBar shows a clear button only when it has text', async () => {
    function Harness() {
      const [q, setQ] = useState('abc');
      return <SearchBar value={q} onChangeText={setQ} testID="sb" />;
    }
    await renderThemed(<Harness />);
    await fireEvent.press(screen.getByLabelText('Clear search'));
    expect(screen.queryByLabelText('Clear search')).toBeNull();
  });
});
