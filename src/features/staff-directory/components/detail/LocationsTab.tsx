import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { ClockynMap, type MapMarkerSpec } from '@/lib/platform/maps';
import { BottomSheet, Button, Card, EmptyState, ErrorState, Icon, ListItem, MonthYearPicker, Skeleton, Text } from '@/components/ui';
import { useBreakpoint } from '@/components/layout';
import { daysInMonth, formatDate, formatTime12, makeDateStr } from '@/lib/datetime';
import { spacing, useTheme } from '@/theme';

import type { MonthAttendance } from '../../hooks/useMonthAttendance';
import { usePunchPins } from '../../hooks/useStaffExtras';
import { datesWithLocation } from '../../utils/attendanceDerive';
import type { PeriodProps } from './CalendarTab';

export interface LocationsTabProps extends PeriodProps {
  staffId: string;
  staffName: string;
  attendance: MonthAttendance;
  /** Selected punch-location date (`YYYY-MM-DD`) or null. */
  date: string | null;
  onDateChange: (date: string) => void;
}

/** Where the staff member punched in (green pin) and out (red pin) on a chosen day of the month. */
export function LocationsTab({ staffId, staffName, attendance, period, onPeriodChange, yearRange, date, onDateChange }: LocationsTabProps) {
  const { colors } = useTheme();
  const { isDesktop } = useBreakpoint();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pins = usePunchPins(staffId, date);

  const withLocation = useMemo(() => datesWithLocation(attendance.records), [attendance.records]);
  const days = useMemo(
    () => Array.from({ length: daysInMonth(period.year, period.month) }, (_, i) => makeDateStr(period.year, period.month, i + 1)),
    [period.year, period.month],
  );

  const pin = pins.pin;
  const markers = useMemo<MapMarkerSpec[]>(() => {
    if (!pin) return [];
    const out: MapMarkerSpec[] = [];
    if (pin.punchInLocation) {
      out.push({
        id: 'in',
        ...pin.punchInLocation,
        title: staffName,
        description: `Punch In: ${formatTime12(pin.punchIn)}`,
        color: colors.success,
        label: 'In',
      });
    }
    if (pin.punchOutLocation) {
      out.push({
        id: 'out',
        ...pin.punchOutLocation,
        title: staffName,
        description: `Punch Out: ${formatTime12(pin.punchOut)}`,
        color: colors.danger,
        label: 'Out',
      });
    }
    return out;
  }, [pin, staffName, colors.success, colors.danger]);

  let body: React.ReactNode;
  if (!date) {
    body = <EmptyState compact icon="map-pin" title="Select Date" message="Choose a day to see where this staff member punched in and out." />;
  } else if (pins.isLoading) {
    body = <Skeleton height={320} />;
  } else if (pins.isError) {
    body = <ErrorState compact message={pins.errorMessage} onRetry={pins.refetch} />;
  } else if (markers.length === 0) {
    body = <EmptyState compact icon="map-pin" title="No punch-in location data available for selected date" />;
  } else {
    body = (
      <Card padding={0} style={{ overflow: 'hidden' }}>
        <ClockynMap
          height={isDesktop ? 440 : 320}
          region={{ latitude: markers[0].latitude, longitude: markers[0].longitude, zoom: 16 }}
          markers={markers}
          fitToMarkers
          mapType="hybrid"
          testID="punch-map"
        />
      </Card>
    );
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <MonthYearPicker month={period.month} year={period.year} onChange={onPeriodChange} yearRange={yearRange} />
      <Button
        title={date ? formatDate(date, 'd-M-yyyy') : 'Select Date'}
        icon="calendar"
        variant="secondary"
        onPress={() => setPickerOpen(true)}
        testID="location-date-button"
      />
      {body}

      <BottomSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title="Select Date" snap="tall">
        {days.map((d) => {
          const marked = withLocation.has(d);
          return (
            <ListItem
              key={d}
              title={formatDate(d, 'd-M-yyyy')}
              left={<Icon name="calendar" size={18} color={d === date ? 'primary' : 'textMuted'} />}
              right={marked ? <Icon name="map-pin" size={18} color="success" /> : undefined}
              onPress={() => {
                onDateChange(d);
                setPickerOpen(false);
              }}
              divider
              accessibilityLabel={`${formatDate(d, 'd-M-yyyy')}${marked ? ', has location' : ''}`}
            />
          );
        })}
        <Text variant="caption" color="textMuted" style={{ marginTop: spacing.sm }}>
          A map pin marks days with a recorded punch location.
        </Text>
      </BottomSheet>
    </View>
  );
}
