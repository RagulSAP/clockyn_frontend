import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  type ScrollViewInstance,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { radii, spacing, useTheme } from '@/theme';
import { Skeleton } from './Skeleton';
import { Text } from './Text';
import { Touchable } from './internal/Touchable';

export type DataTableColumn<T> = {
  key: string;
  title: string;
  /** Column width in px (default 120). */
  width?: number;
  /** Pin to the left. If no column sets this, the first `frozenColumns` columns are pinned. */
  frozen?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (row: T, index: number) => React.ReactNode;
};

/** A group heading spanning `span` consecutive columns (counted in display order: frozen columns first). */
export type DataTableHeaderGroup = { title: string; span: number };

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: keyof T | ((row: T, index: number) => string);
  headerGroups?: DataTableHeaderGroup[];
  frozenColumns?: number;
  onRowPress?: (row: T, index: number) => void;
  loading?: boolean;
  emptyText?: string;
  rowHeight?: number;
  /**
   * Caps the table height; the body then scrolls vertically (frozen and scrolling panes stay in sync) with a
   * sticky header. Without it the table is as tall as its rows and the surrounding screen scrolls.
   */
  maxHeight?: number;
  /** Subtle zebra striping (default true). */
  striped?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const DEFAULT_COL_WIDTH = 120;
const HEADER_H = 44;
const GROUP_H = 34;

let scrollbarCache: number | null = null;
/** Thickness of a classic (non-overlay) scrollbar on web; 0 on native / overlay scrollbars. */
function scrollbarThickness(): number {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return 0;
  if (scrollbarCache !== null) return scrollbarCache;
  const probe = document.createElement('div');
  probe.style.cssText = 'overflow:scroll;height:50px;width:50px;position:absolute;visibility:hidden;top:-999px';
  document.body.appendChild(probe);
  scrollbarCache = probe.offsetHeight - probe.clientHeight;
  document.body.removeChild(probe);
  return scrollbarCache;
}

type Seg = { title?: string; width: number };

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  headerGroups,
  frozenColumns = 1,
  onRowPress,
  loading,
  emptyText = 'No records found',
  rowHeight = 52,
  maxHeight,
  striped = true,
  style,
  testID,
}: DataTableProps<T>) {
  const { colors } = useTheme();
  const [containerW, setContainerW] = useState(0);
  const [scrolledX, setScrolledX] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const frozenRef = useRef<ScrollViewInstance>(null);
  const bodyRef = useRef<ScrollViewInstance>(null);
  const lastY = useRef(0);

  const { frozenCols, bodyCols, groupOf } = useMemo(() => {
    const anyFlag = columns.some((c) => c.frozen);
    const frozen = anyFlag ? columns.filter((c) => c.frozen) : columns.slice(0, Math.max(0, frozenColumns));
    const body = columns.filter((c) => !frozen.includes(c));
    const ordered = [...frozen, ...body];
    const map = new Map<string, number>();
    let cursor = 0;
    (headerGroups ?? []).forEach((g, gi) => {
      for (let i = 0; i < g.span && cursor < ordered.length; i++, cursor++) map.set(ordered[cursor].key, gi);
    });
    return { frozenCols: frozen, bodyCols: body, groupOf: map };
  }, [columns, frozenColumns, headerGroups]);

  const w = (c: DataTableColumn<T>) => c.width ?? DEFAULT_COL_WIDTH;
  const frozenW = frozenCols.reduce((s, c) => s + w(c), 0);
  const bodyBaseW = bodyCols.reduce((s, c) => s + w(c), 0);
  const extra = containerW > 0 ? Math.max(0, containerW - frozenW - bodyBaseW) : 0;
  const widthOf = (c: DataTableColumn<T>) => (bodyCols.length && c === bodyCols[bodyCols.length - 1] ? w(c) + extra : w(c));
  const bodyW = bodyBaseW + (bodyCols.length ? extra : 0);

  const hasGroups = !!headerGroups?.length;
  const headerTotal = HEADER_H + (hasGroups ? GROUP_H : 0);
  const sb = scrollbarThickness();
  const hasHBar = sb > 0 && containerW > 0 && bodyBaseW > containerW - frozenW;

  const getKey = (row: T, i: number): string =>
    typeof rowKey === 'function' ? rowKey(row, i) : String(row[rowKey] as unknown as string | number);

  const segments = (cols: DataTableColumn<T>[], widthFn: (c: DataTableColumn<T>) => number): Seg[] => {
    const out: Seg[] = [];
    let lastGroup: number | undefined | null = null;
    cols.forEach((c) => {
      const g = groupOf.get(c.key);
      if (out.length && g === lastGroup && g !== undefined) {
        out[out.length - 1].width += widthFn(c);
      } else {
        out.push({ title: g !== undefined ? headerGroups?.[g].title : undefined, width: widthFn(c) });
      }
      lastGroup = g;
    });
    return out;
  };

  const syncVertical = useCallback((from: 'frozen' | 'body') => (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    if (Math.abs(y - lastY.current) < 0.5) return;
    lastY.current = y;
    (from === 'frozen' ? bodyRef : frozenRef).current?.scrollTo({ y, animated: false });
  }, []);

  const onHorizontalScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const moved = e.nativeEvent.contentOffset.x > 2;
    setScrolledX((prev) => (prev === moved ? prev : moved));
  }, []);

  const renderHeaderCell = (c: DataTableColumn<T>, width: number) => (
    <View
      key={c.key}
      style={{ width, height: HEADER_H, paddingHorizontal: spacing.md, justifyContent: 'center', alignItems: alignment(c.align) }}
    >
      <Text variant="caption" weight="bold" color="textSecondary" numberOfLines={2} align={c.align}>
        {c.title}
      </Text>
    </View>
  );

  const renderGroupRow = (segs: Seg[]) =>
    hasGroups ? (
      <View style={{ flexDirection: 'row', height: GROUP_H }}>
        {segs.map((s, i) => (
          <View
            key={i}
            style={{
              width: s.width,
              height: GROUP_H,
              justifyContent: 'center',
              alignItems: 'center',
              borderBottomWidth: s.title ? 1 : 0,
              borderBottomColor: colors.border,
              borderLeftWidth: s.title && i > 0 ? 1 : 0,
              borderLeftColor: colors.border,
            }}
          >
            {s.title ? (
              <Text variant="micro" color="primary" numberOfLines={1}>
                {s.title.toUpperCase()}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    ) : null;

  const renderCell = (c: DataTableColumn<T>, row: T, i: number, width: number) => {
    let content: React.ReactNode;
    if (c.render) content = c.render(row, i);
    else {
      const raw = (row as Record<string, unknown>)[c.key];
      content = (
        <Text variant="callout" numberOfLines={2} align={c.align}>
          {raw === null || raw === undefined || raw === '' ? '—' : String(raw)}
        </Text>
      );
    }
    return (
      <View key={c.key} style={{ width, height: rowHeight, paddingHorizontal: spacing.md, justifyContent: 'center', alignItems: alignment(c.align) }}>
        {content}
      </View>
    );
  };

  const rowBg = (i: number) => (hoverIdx === i && onRowPress ? colors.primarySoft : striped && i % 2 === 1 ? colors.surfaceMuted : colors.surface);

  const renderRows = (cols: DataTableColumn<T>[], widthFn: (c: DataTableColumn<T>) => number, totalW: number) => {
    if (loading) {
      return Array.from({ length: 6 }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row', height: rowHeight, alignItems: 'center', width: totalW, backgroundColor: colors.surface }}>
          {cols.map((c) => (
            <View key={c.key} style={{ width: widthFn(c), paddingHorizontal: spacing.md }}>
              <Skeleton height={12} width="70%" />
            </View>
          ))}
        </View>
      ));
    }
    return rows.map((row, i) => {
      const cells = cols.map((c) => renderCell(c, row, i, widthFn(c)));
      const base: ViewStyle = { flexDirection: 'row', width: totalW, height: rowHeight, backgroundColor: rowBg(i) };
      return onRowPress ? (
        <Touchable
          key={getKey(row, i)}
          onPress={() => onRowPress(row, i)}
          onHoverIn={() => setHoverIdx(i)}
          onHoverOut={() => setHoverIdx((h) => (h === i ? null : h))}
          accessibilityRole="button"
          pressedStyle={{ opacity: 1, backgroundColor: colors.primarySoft }}
          noFocusRing={false}
          style={base}
        >
          {cells}
        </Touchable>
      ) : (
        <View key={getKey(row, i)} style={base}>
          {cells}
        </View>
      );
    });
  };

  const bodyScrollHeight = maxHeight ? Math.max(rowHeight, maxHeight - headerTotal - (hasHBar ? sb : 0)) : undefined;

  const frozenSegs = segments(frozenCols, w);
  const bodySegs = segments(bodyCols, widthOf);
  // a group that straddles the frozen/body boundary shows its title only in the frozen pane
  const lastFrozen = frozenCols[frozenCols.length - 1];
  if (lastFrozen && bodyCols.length && bodySegs.length) {
    const g = groupOf.get(lastFrozen.key);
    if (g !== undefined && g === groupOf.get(bodyCols[0].key)) bodySegs[0] = { ...bodySegs[0], title: undefined };
  }

  const frozenPane = frozenCols.length ? (
    <View
      style={{
        width: frozenW,
        backgroundColor: colors.surface,
        zIndex: 2,
        ...(scrolledX
          ? { shadowColor: colors.shadow, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 4, height: 0 }, elevation: 4 }
          : null),
      }}
    >
      <View style={{ backgroundColor: colors.surfaceMuted, height: headerTotal }}>
        {renderGroupRow(frozenSegs)}
        <View style={{ flexDirection: 'row' }}>{frozenCols.map((c) => renderHeaderCell(c, w(c)))}</View>
      </View>
      {bodyScrollHeight ? (
        <ScrollView
          ref={frozenRef}
          style={{ height: bodyScrollHeight }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={syncVertical('frozen')}
          nestedScrollEnabled
        >
          {renderRows(frozenCols, w, frozenW)}
        </ScrollView>
      ) : (
        <View>{renderRows(frozenCols, w, frozenW)}</View>
      )}
      {hasHBar && bodyScrollHeight ? <View style={{ height: sb }} /> : null}
    </View>
  ) : null;

  const bodyPane = bodyCols.length ? (
    <ScrollView
      horizontal
      style={{ flex: 1 }}
      showsHorizontalScrollIndicator
      scrollEventThrottle={16}
      onScroll={onHorizontalScroll}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ width: bodyW }}>
        <View style={{ backgroundColor: colors.surfaceMuted, height: headerTotal }}>
          {renderGroupRow(bodySegs)}
          <View style={{ flexDirection: 'row' }}>{bodyCols.map((c) => renderHeaderCell(c, widthOf(c)))}</View>
        </View>
        {bodyScrollHeight ? (
          <ScrollView
            ref={bodyRef}
            style={{ height: bodyScrollHeight }}
            scrollEventThrottle={16}
            onScroll={syncVertical('body')}
            nestedScrollEnabled
          >
            {renderRows(bodyCols, widthOf, bodyW)}
          </ScrollView>
        ) : (
          <View>{renderRows(bodyCols, widthOf, bodyW)}</View>
        )}
      </View>
    </ScrollView>
  ) : null;

  return (
    <View
      testID={testID}
      onLayout={(e: LayoutChangeEvent) => setContainerW(e.nativeEvent.layout.width)}
      style={[{ alignSelf: 'stretch', borderRadius: radii.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, style]}
    >
      <View style={{ flexDirection: 'row' }}>
        {frozenPane}
        {bodyPane}
      </View>
      {!loading && rows.length === 0 ? (
        <View style={{ padding: spacing.xxl, alignItems: 'center' }}>
          <Text color="textMuted">{emptyText}</Text>
        </View>
      ) : null}
    </View>
  );
}

function alignment(a?: 'left' | 'center' | 'right'): 'flex-start' | 'center' | 'flex-end' {
  return a === 'center' ? 'center' : a === 'right' ? 'flex-end' : 'flex-start';
}
