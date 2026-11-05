import React, { useState } from 'react';
import { View } from 'react-native';
import { spacing, useTheme, useThemePreference, type ThemePreference } from '@/theme';
import { Screen, Section, FormSection, ResponsiveRow, useBreakpoint } from '@/components/layout';
import {
  Avatar,
  Badge,
  BottomSheet,
  BrandMark,
  Button,
  Calendar,
  Card,
  Checkbox,
  CountBadge,
  DataTable,
  DateField,
  Divider,
  EmptyState,
  ErrorState,
  FAB,
  FilterChips,
  GradientView,
  Icon,
  IconButton,
  ImageViewer,
  ListItem,
  LoadingOverlay,
  Modal,
  MonthYearPicker,
  MultiSelect,
  OTPInput,
  RadioGroup,
  SearchBar,
  SectionHeader,
  SegmentedControl,
  Select,
  Skeleton,
  SkeletonList,
  Spacer,
  Spinner,
  StatCard,
  StatusPill,
  Switch,
  Tabs,
  Text,
  TextField,
  TimeField,
  iconNames,
  useConfirm,
  useToast,
  type MarkedDate,
} from '@/components/ui';

const THEME_OPTIONS: { label: string; value: ThemePreference }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

type Row = { id: string; name: string; dept: string; present: number; absent: number; late: number; net: string };
const ROWS: Row[] = Array.from({ length: 14 }, (_, i) => ({
  id: String(i + 1),
  name: ['Asha Verma', 'Rahul Nair', 'Meera Iyer', 'Kabir Shah', 'Isha Rao', 'Dev Patel', 'Anaya Roy'][i % 7],
  dept: ['Sales', 'Operations', 'Finance'][i % 3],
  present: 20 + (i % 6),
  absent: i % 4,
  late: i % 3,
  net: `₹${(28000 + i * 1350).toLocaleString('en-IN')}`,
}));

const SAMPLE_IMAGE = 'https://picsum.photos/seed/clockyn/900/600';

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Section title={title} gap={spacing.md}>
      {children}
    </Section>
  );
}

export function UiKitGallery() {
  const { colors, scheme } = useTheme();
  const { preference, setPreference } = useThemePreference();
  const { isPhone, isTablet, isDesktop, width } = useBreakpoint();
  const toast = useToast();
  const confirm = useConfirm();

  const [text, setText] = useState('');
  const [secret, setSecret] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [multi, setMulti] = useState<string[]>(['a']);
  const [date, setDate] = useState('2026-10-18');
  const [time, setTime] = useState('09:30');
  const [month, setMonth] = useState({ month: 10, year: 2026 });
  const [seg, setSeg] = useState('day');
  const [tab, setTab] = useState('all');
  const [chip, setChip] = useState<string | null>('all');
  const [chips, setChips] = useState<string[]>(['present']);
  const [on, setOn] = useState(true);
  const [checked, setChecked] = useState(true);
  const [radio, setRadio] = useState('monthly');
  const [modal, setModal] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [viewer, setViewer] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [iconFilter, setIconFilter] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  const marked: Record<string, MarkedDate> = {
    '2026-10-01': { color: colors.statusPresent, label: 'P' },
    '2026-10-02': { color: colors.statusAbsent, label: 'A' },
    '2026-10-05': { color: colors.statusLate, label: 'L' },
    '2026-10-06': { color: colors.statusHalfDay, label: 'H' },
    '2026-10-09': { color: colors.statusLeave, label: 'LV' },
    '2026-10-12': { color: colors.statusHoliday, label: 'HD' },
    '2026-10-14': { dots: [colors.primary, colors.accent] },
  };

  const filteredIcons = iconNames.filter((n) => n.includes(iconFilter.trim().toLowerCase()));

  return (
    <Screen
      title="UI kit"
      subtitle={`${scheme} theme · ${width}px · ${isDesktop ? 'desktop' : isTablet ? 'tablet' : isPhone ? 'phone' : ''}`}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 900);
      }}
      footer={<Button title="Sticky footer action" onPress={() => toast.success('Footer pressed')} fullWidth />}
      overlay={<FAB icon="plus" label="New" onPress={() => toast.success('FAB pressed')} bottomOffset={96} />}
      contentStyle={{ gap: spacing.xxl }}
      testID="ui-kit"
    >
      <Block title="Theme">
        <SegmentedControl options={THEME_OPTIONS} value={preference} onChange={setPreference} />
      </Block>

      <Block title="Brand">
        <Card>
          <View style={{ gap: spacing.xl, alignItems: 'flex-start' }}>
            <BrandMark variant="wordmark" size={44} />
            <View style={{ flexDirection: 'row', gap: spacing.xxl, alignItems: 'flex-end' }}>
              <BrandMark variant="mark" size={56} />
              <BrandMark variant="stacked" size={56} />
            </View>
          </View>
        </Card>
        <Card variant="gradient" padding={spacing.xl}>
          <BrandMark variant="wordmark" size={36} tone="light" />
          <Text variant="body" color="onPrimary" style={{ marginTop: spacing.sm }}>
            Gradient hero card
          </Text>
        </Card>
      </Block>

      <Block title="Typography">
        <Card>
          <Text variant="display">Display 32</Text>
          <Text variant="title1">Title 1 · 26</Text>
          <Text variant="title2">Title 2 · 21</Text>
          <Text variant="title3">Title 3 · 17</Text>
          <Text variant="body">Body 15 — the quick brown fox jumps over the lazy dog.</Text>
          <Text variant="bodyStrong">Body strong</Text>
          <Text variant="callout" color="textSecondary">Callout secondary</Text>
          <Text variant="caption" color="textMuted">Caption muted</Text>
          <Text variant="micro" color="primary">MICRO PRIMARY</Text>
          <Text variant="mono">mono 0123456789</Text>
        </Card>
      </Block>

      <Block title="Buttons">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          <Button title="Primary" onPress={() => toast.info('Primary')} />
          <Button title="Secondary" variant="secondary" onPress={() => {}} />
          <Button title="Ghost" variant="ghost" onPress={() => {}} />
          <Button title="Danger" variant="danger" icon="trash" onPress={() => {}} />
          <Button title="Success" variant="success" icon="check" onPress={() => {}} />
          <Button title="Loading" loading onPress={() => {}} />
          <Button title="Disabled" disabled onPress={() => {}} />
          <Button title="Small" size="sm" icon="plus" onPress={() => {}} />
          <Button title="Large" size="lg" iconRight="arrow-right" onPress={() => {}} />
        </View>
        <Button title="Full width" fullWidth onPress={() => {}} />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <IconButton icon="bell" accessibilityLabel="Notifications" onPress={() => {}} />
          <IconButton icon="settings" variant="tonal" accessibilityLabel="Settings" onPress={() => {}} />
          <IconButton icon="plus" variant="filled" accessibilityLabel="Add" onPress={() => {}} />
        </View>
      </Block>

      <Block title="Icons">
        <SearchBar value={iconFilter} onChangeText={setIconFilter} placeholder={`Filter ${iconNames.length} icons`} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {filteredIcons.map((n) => (
            <View key={n} style={{ width: 76, alignItems: 'center', gap: 4 }}>
              <Icon name={n} size={22} />
              <Text variant="micro" color="textMuted" numberOfLines={1}>
                {n}
              </Text>
            </View>
          ))}
        </View>
      </Block>

      <Block title="Inputs">
        <FormSection title="Form section" description="Fields grouped on a card">
          <TextField label="Full name" value={text} onChangeText={setText} placeholder="e.g. Asha Verma" leftIcon="user" required />
          <TextField label="Mobile" value={text} onChangeText={setText} prefix="+91" keyboardType="phone-pad" maxLength={10} showCounter />
          <TextField label="Password" value={secret} onChangeText={setSecret} secure placeholder="••••••••" leftIcon="lock" />
          <TextField label="With error" value="abc" onChangeText={() => {}} error="This field has an error" />
          <TextField label="Notes" value={text} onChangeText={setText} multiline numberOfLines={3} hint="Multiline field with a hint" />
          <TextField label="Disabled" value="Read only" onChangeText={() => {}} editable={false} />
        </FormSection>
        <Card>
          <Text variant="callout" weight="semibold" color="textSecondary" style={{ marginBottom: spacing.sm }}>
            OTP
          </Text>
          <OTPInput value={otp} onChange={(v) => { setOtp(v); setOtpError(false); }} error={otpError ? 'Invalid code' : undefined} />
          <Spacer />
          <Button title="Trigger OTP error" size="sm" variant="secondary" onPress={() => setOtpError(true)} />
        </Card>
        <Select
          label="Select"
          value={sel}
          onChange={setSel}
          options={[
            { label: 'Head office', value: 'ho', subtitle: 'Mumbai' },
            { label: 'Pune branch', value: 'pn', subtitle: '12 staff' },
            { label: 'Chennai branch', value: 'ch' },
          ]}
          placeholder="Choose branch"
          leftIcon="building"
        />
        <Select
          label="Searchable select (30 options)"
          value={sel}
          onChange={setSel}
          searchable
          options={Array.from({ length: 30 }, (_, i) => ({ label: `Option ${i + 1}`, value: `o${i + 1}` }))}
        />
        <MultiSelect
          label="MultiSelect"
          values={multi}
          onChange={setMulti}
          selectAll
          options={[
            { label: 'Alpha', value: 'a' },
            { label: 'Bravo', value: 'b' },
            { label: 'Charlie', value: 'c' },
          ]}
        />
        <ResponsiveRow columns={{ phone: 1, tablet: 3, desktop: 3 }}>
          <DateField label="Date" value={date} onChange={setDate} minDate="2026-01-01" />
          <TimeField label="Time" value={time} onChange={setTime} />
          <Card variant="muted" padding={spacing.md}>
            <MonthYearPicker month={month.month} year={month.year} onChange={setMonth} />
          </Card>
        </ResponsiveRow>
        <Card style={{ gap: spacing.lg }}>
          <Switch label="Switch" description="Controlled toggle" value={on} onValueChange={setOn} />
          <Checkbox label="Checkbox" checked={checked} onChange={setChecked} />
          <RadioGroup
            value={radio}
            onChange={setRadio}
            options={[
              { label: 'Monthly', value: 'monthly', description: 'Billed every month' },
              { label: 'Yearly', value: 'yearly', description: 'Two months free' },
            ]}
          />
        </Card>
      </Block>

      <Block title="Navigation & filters">
        <SegmentedControl options={[{ label: 'Day', value: 'day' }, { label: 'Week', value: 'week' }, { label: 'Month', value: 'month' }]} value={seg} onChange={setSeg} />
        <Tabs
          tabs={[{ key: 'all', label: 'All' }, { key: 'pending', label: 'Pending', badge: 4 }, { key: 'approved', label: 'Approved' }, { key: 'rejected', label: 'Rejected', badge: 120 }, { key: 'x', label: 'Archived' }]}
          active={tab}
          onChange={setTab}
        />
        <FilterChips options={[{ label: 'All', value: 'all' }, { label: 'Present', value: 'present', count: 18 }, { label: 'Absent', value: 'absent', count: 2 }, { label: 'Late', value: 'late', icon: 'clock' }]} value={chip} onChange={setChip} />
        <FilterChips<string> multiple scroll={false} options={[{ label: 'Present', value: 'present' }, { label: 'Absent', value: 'absent' }, { label: 'Late', value: 'late' }, { label: 'Leave', value: 'leave' }]} value={chips} onChange={setChips} />
      </Block>

      <Block title="Badges, avatars, stats">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' }}>
          <Badge label="Neutral" />
          <Badge label="Primary" tone="primary" />
          <Badge label="Success" tone="success" icon="check" />
          <Badge label="Warning" tone="warning" />
          <Badge label="Danger" tone="danger" />
          <Badge label="Info" tone="info" size="sm" />
          <CountBadge count={3} />
          <CountBadge count={250} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {['pending', 'approved', 'rejected', 'present', 'absent', 'late', 'half_day', 'active', 'inactive'].map((s) => (
            <StatusPill key={s} status={s} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <Avatar name="Asha Verma" size={48} status="online" />
          <Avatar name="Rahul Nair" size={40} status="busy" />
          <Avatar name="Meera" size={32} />
          <Avatar uri="https://picsum.photos/seed/clockyn-avatar/120/120" name="Photo" size={48} />
          <Avatar name="" size={40} />
        </View>
        <ResponsiveRow columns={{ phone: 2, tablet: 4, desktop: 4 }}>
          <StatCard label="Present today" value={42} icon="user-check" tone="success" trend={{ value: '+6%', direction: 'up' }} />
          <StatCard label="Absent" value={3} icon="user-x" tone="danger" trend={{ value: '+1', direction: 'up', positive: false }} />
          <StatCard label="Late" value={5} icon="clock" tone="warning" caption="vs 7 yesterday" />
          <StatCard label="Loading" value="-" loading icon="users" tone="info" />
        </ResponsiveRow>
      </Block>

      <Block title="Lists">
        <Card padding={0}>
          <ListItem icon="users" title="Staff directory" subtitle="42 active" onPress={() => {}} divider />
          <ListItem left={<Avatar name="Asha Verma" size={40} status />} title="Asha Verma" subtitle="Sales · Mumbai" right={<StatusPill status="present" size="sm" />} onPress={() => {}} divider />
          <ListItem icon="wallet" iconTone="success" title="With switch" right={<Switch value={on} onValueChange={setOn} />} divider />
          <ListItem icon="trash" title="Delete account" destructive onPress={() => {}} />
        </Card>
        <SectionHeader title="Section header" subtitle="With an action" action={{ label: 'See all', onPress: () => toast.info('See all') }} />
      </Block>

      <Block title="Calendar">
        <Card>
          <Calendar
            month={month.month}
            year={month.year}
            onMonthChange={setMonth}
            markedDates={marked}
            selectedDates={picked}
            onDayPress={(d) => setPicked((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]))}
            maxDate="2026-12-31"
          />
        </Card>
      </Block>

      <Block title="Data table (frozen first column, header groups)">
        <DataTable<Row>
          maxHeight={360}
          rows={ROWS}
          rowKey="id"
          onRowPress={(r) => toast.info(`Open ${r.name}`)}
          headerGroups={[{ title: 'Employee', span: 2 }, { title: 'Attendance', span: 3 }, { title: 'Payroll', span: 1 }]}
          columns={[
            { key: 'name', title: 'Name', width: 150, render: (r) => <Text variant="callout" weight="semibold">{r.name}</Text> },
            { key: 'dept', title: 'Department', width: 130 },
            { key: 'present', title: 'Present', width: 90, align: 'right' },
            { key: 'absent', title: 'Absent', width: 90, align: 'right' },
            { key: 'late', title: 'Late', width: 90, align: 'right' },
            { key: 'net', title: 'Net pay', width: 130, align: 'right' },
          ]}
        />
        <DataTable<Row> rows={[]} rowKey="id" columns={[{ key: 'name', title: 'Name' }, { key: 'dept', title: 'Department' }]} emptyText="Empty table state" />
      </Block>

      <Block title="Feedback">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          <Button title="Toast success" size="sm" variant="success" onPress={() => toast.success('Saved successfully')} />
          <Button title="Toast error" size="sm" variant="danger" onPress={() => toast.error('Something failed. Please retry.')} />
          <Button title="Toast info" size="sm" variant="secondary" onPress={() => toast.info('Heads up')} />
          <Button
            title="Confirm"
            size="sm"
            variant="secondary"
            onPress={async () => {
              const ok = await confirm({ title: 'Delete this record?', message: 'This cannot be undone.', confirmText: 'Delete', destructive: true });
              toast.info(ok ? 'Confirmed' : 'Cancelled');
            }}
          />
          <Button title="Modal" size="sm" variant="secondary" onPress={() => setModal(true)} />
          <Button title="Bottom sheet" size="sm" variant="secondary" onPress={() => setSheet(true)} />
          <Button
            title="Loading overlay"
            size="sm"
            variant="secondary"
            onPress={() => {
              setOverlay(true);
              setTimeout(() => setOverlay(false), 1800);
            }}
          />
          <Button title="Image viewer" size="sm" variant="secondary" onPress={() => setViewer(true)} />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'center' }}>
          <Spinner />
          <Spinner size="large" />
          <Skeleton width={120} height={16} />
          <Skeleton circle height={40} />
        </View>
        <SkeletonList count={3} />
        <ResponsiveRow columns={{ phone: 1, tablet: 2, desktop: 2 }}>
          <Card variant="outlined" padding={0}>
            <EmptyState icon="inbox" title="Nothing here yet" message="When there is data it will appear here." action={{ label: 'Add first item', onPress: () => {}, icon: 'plus' }} compact />
          </Card>
          <Card variant="outlined" padding={0}>
            <ErrorState message="We could not load the data." onRetry={() => toast.info('Retrying')} compact />
          </Card>
        </ResponsiveRow>
      </Block>

      <Block title="Surfaces">
        <ResponsiveRow columns={{ phone: 1, tablet: 2, desktop: 4 }}>
          <Card><Text variant="bodyStrong">Default card</Text></Card>
          <Card variant="outlined"><Text variant="bodyStrong">Outlined</Text></Card>
          <Card variant="muted"><Text variant="bodyStrong">Muted</Text></Card>
          <Card onPress={() => toast.info('Pressed card')}><Text variant="bodyStrong">Pressable</Text></Card>
        </ResponsiveRow>
        <GradientView style={{ height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="title3" color="onPrimary">GradientView</Text>
        </GradientView>
        <Divider />
      </Block>

      <View style={{ height: 80 }} />

      <Modal
        visible={modal}
        onClose={() => setModal(false)}
        title="Modal title"
        footer={
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button title="Cancel" variant="secondary" onPress={() => setModal(false)} style={{ flex: 1 }} />
            <Button title="Toast above" onPress={() => toast.success('Toast over modal')} style={{ flex: 1 }} />
          </View>
        }
      >
        <Text color="textSecondary">Centred dialog, width-capped on web. Toasts render above it.</Text>
      </Modal>
      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title="Bottom sheet">
        <Text color="textSecondary">Drag the handle to dismiss. On wide screens this is a centred dialog.</Text>
        <Spacer />
        <Button title="Close" fullWidth onPress={() => setSheet(false)} />
      </BottomSheet>
      <LoadingOverlay visible={overlay} message="Saving…" />
      <ImageViewer visible={viewer} uri={SAMPLE_IMAGE} onClose={() => setViewer(false)} />
    </Screen>
  );
}
