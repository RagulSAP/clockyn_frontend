import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';

import { Screen, useBreakpoint } from '@/components/layout';
import { Button, Card, Divider, EmptyState, ErrorState, FilterChips, SearchBar, SkeletonList, Text } from '@/components/ui';
import { useDebounce } from '@/hooks';
import { getErrorMessage } from '@/lib/api/errors';
import { routes, useAppRouter } from '@/lib/navigation';
import { radii, spacing, useTheme } from '@/theme';
import type { SupportFaq } from '@/types/api/support';

import { AdminOnly } from '../components/AdminOnly';
import { BucketIcon, FaqBucketTile, questionsLabel } from '../components/FaqBucketTile';
import { FaqRow } from '../components/FaqRow';
import { useSupportFaqs } from '../hooks/useSupportFaqs';
import { bucketSlug, faqBuckets, findBucket, groupByBucket, groupByCategory, searchFaqs, searchWords } from '../utils/faq';

const SEARCH_DEBOUNCE_MS = 150;
type BeforeRemove = {
  addListener: (type: 'beforeRemove', cb: (e: { preventDefault: () => void; data?: { action?: { type?: string } } }) => void) => () => void;
};
const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/**
 * Support > FAQ (admins only).
 *  - landing: search bar + a tile per BUCKET (top-level group);
 *  - bucket view: its questions under CATEGORY sub-headers, every FAQ an expandable row, chips to jump to another bucket;
 *  - search: always over ALL buckets (question, answer, category, bucket), ranked, matches in bold, each with its bucket > category chip;
 *  - desktop: a sticky bucket list on the left, the questions on the right.
 * The bucket (and optional category) can be deep-linked with the `bucket` / `category` route params.
 */
export default function FaqScreen() {
  return (
    <AdminOnly>
      <Faq />
    </AdminOnly>
  );
}

function NavItem({ label, count, selected, onPress, testID, icon }: { label: string; count: number; selected: boolean; onPress: () => void; testID: string; icon: string | null }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      aria-selected={selected}
      testID={testID}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) => ({
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radii.md,
        backgroundColor: selected ? colors.primarySoft : hovered ? colors.surfaceMuted : 'transparent',
      })}
    >
      {icon ? <BucketIcon name={icon} size={28} /> : null}
      <Text variant="body" weight={selected ? 'semibold' : 'medium'} style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="caption" color="textMuted">
        {count}
      </Text>
    </Pressable>
  );
}

function Faq() {
  const router = useAppRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ bucket?: string; category?: string }>();
  const { isDesktop, isPhone } = useBreakpoint();
  const faqs = useSupportFaqs();

  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, SEARCH_DEBOUNCE_MS);
  const q = query.trim() === '' ? '' : debounced; // clearing is instant, typing is debounced
  // `undefined` = "follow the link params"; a value (or null = the tiles / "All questions") = the user picked.
  const [pickedBucket, setPickedBucket] = useState<string | null | undefined>(undefined);
  const [pickedCategory, setPickedCategory] = useState<string | null | undefined>(undefined);
  // Which rows are open, by FAQ id. Rows toggle independently; the state lives here so it survives searching,
  // switching bucket and any other re-render of the list.
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);

  const all = useMemo(() => faqs.data ?? [], [faqs.data]);
  const buckets = useMemo(() => faqBuckets(all), [all]);

  const linkCategory = one(params.category)?.toLowerCase();
  const linkBucket =
    findBucket(buckets, one(params.bucket)) ?? (linkCategory ? (all.find((f) => f.category.toLowerCase() === linkCategory)?.bucket ?? null) : null);
  const bucket = pickedBucket !== undefined ? pickedBucket : linkBucket;
  const linkedCategory =
    bucket && linkCategory ? (buckets.find((b) => b.name === bucket)?.categories.find((c) => c.toLowerCase() === linkCategory) ?? null) : null;
  const category = pickedCategory !== undefined ? pickedCategory : linkedCategory;

  const words = useMemo(() => searchWords(q), [q]);
  const searching = words.length > 0;
  const results = useMemo(() => searchFaqs(all, q), [all, q]);
  const bucketItems = useMemo(() => (bucket ? all.filter((f) => f.bucket === bucket && (!category || f.category === category)) : []), [all, bucket, category]);
  const drilled = !!bucket && !isDesktop && !searching;

  const selectBucket = (name: string | null) => {
    setPickedBucket(name);
    setPickedCategory(null);
    setQuery('');
  };

  // The system / browser / swipe back from a bucket returns to the tiles instead of leaving the screen.
  useEffect(() => {
    if (!drilled) return undefined;
    return (navigation as unknown as BeforeRemove).addListener('beforeRemove', (e) => {
      const type = e.data?.action?.type;
      if (type !== 'GO_BACK' && type !== 'POP') return; // a replace / reset (e.g. sign-out) goes through
      e.preventDefault();
      setPickedBucket(null);
      setPickedCategory(null);
    });
  }, [drilled, navigation]);

  // Web: the browser's back button. A bucket opened from the tiles gets its own history entry (same URL), so back pops it and
  // shows the tiles again instead of leaving the screen. Going back from a screen pushed on top of the FAQ lands on that
  // entry again (still flagged), which keeps the bucket open.
  const unmounting = useRef(false);
  useEffect(
    () => () => {
      unmounting.current = true;
    },
    [],
  );
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !drilled) return undefined;
    window.history.pushState({ ...(window.history.state ?? {}), faqBucket: true }, '');
    let popped = false;
    const onPop = () => {
      if (window.history.state?.faqBucket) return;
      popped = true;
      setPickedBucket(null);
      setPickedCategory(null);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // closed by the screen's own back arrow / a search: drop the entry we added (not when leaving the screen)
      if (!popped && !unmounting.current && window.history.state?.faqBucket) window.history.back();
    };
  }, [drilled]);

  const toggle = (id: string) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await faqs.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const rows = (items: SupportFaq[], opts: { highlight?: string[]; chips?: boolean } = {}) => (
    <Card padding={0}>
      <View style={{ borderRadius: radii.lg, overflow: 'hidden' }}>
        {items.map((faq, i) => (
          <View key={faq.id}>
            {i > 0 ? <Divider /> : null}
            <FaqRow
              faq={faq}
              expanded={!!open[faq.id]}
              onToggle={() => toggle(faq.id)}
              highlight={opts.highlight}
              chip={opts.chips ? `${faq.bucket} > ${faq.category}` : undefined}
            />
          </View>
        ))}
      </View>
    </Card>
  );

  const subHeader = (name: string, count: number) => (
    <Text variant="micro" color="textMuted" accessibilityRole="header" style={{ textTransform: 'uppercase', paddingHorizontal: spacing.xs }}>
      {name} · {count}
    </Text>
  );

  const categoryGroups = (items: SupportFaq[]) =>
    groupByCategory(items).map((g) => (
      <View key={g.category} style={{ gap: spacing.sm }} testID={`faq-category-${bucketSlug(g.category)}`}>
        {subHeader(g.category, g.items.length)}
        {rows(g.items)}
      </View>
    ));

  const help = (
    <Card style={{ gap: spacing.md }} testID="faq-help-card">
      <View style={{ gap: 2 }}>
        <Text variant="title3">Still need help?</Text>
        <Text variant="body" color="textSecondary">
          Can&apos;t find your answer? Chat with our support team or watch a step-by-step guide.
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Button title="Chat with support" icon="chat" onPress={() => router.push(routes.admin.helpLiveChat)} testID="faq-chat-support" />
        <Button title="Watch guides" icon="play" variant="secondary" onPress={() => router.push(routes.admin.helpVideos)} testID="faq-watch-guides" />
      </View>
    </Card>
  );

  // ── the views of the loaded screen ──────────────────────────────────────────────────────────────────────
  const tiles = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }} testID="faq-tiles">
      {buckets.map((b) => (
        <FaqBucketTile key={b.name} bucket={b} width={isPhone ? '47%' : '31%'} onPress={() => selectBucket(b.name)} />
      ))}
    </View>
  );

  const bucketView = (
    <View style={{ gap: spacing.lg }} testID="faq-bucket-view">
      {isDesktop ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <BucketIcon name={bucket ?? ''} size={36} />
          <View>
            <Text variant="title3" accessibilityRole="header">
              {bucket}
            </Text>
            <Text variant="caption" color="textSecondary">
              {questionsLabel(bucketItems.length)}
            </Text>
          </View>
        </View>
      ) : (
        <FilterChips options={buckets.map((b) => ({ label: b.name, value: b.name, count: b.count }))} value={bucket} onChange={(name) => selectBucket(name)} testID="faq-chips" />
      )}
      {category ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Text variant="caption" color="textSecondary">
            Showing {category} only
          </Text>
          <Button title={`Show all in ${bucket}`} size="sm" variant="secondary" onPress={() => setPickedCategory(null)} testID="faq-show-all-categories" />
        </View>
      ) : null}
      {categoryGroups(bucketItems)}
    </View>
  );

  const everything = (
    <View style={{ gap: spacing.xl }} testID="faq-all-view">
      {groupByBucket(all).map((g) => (
        <View key={g.bucket} style={{ gap: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <BucketIcon name={g.bucket} size={32} />
            <Text variant="title3" accessibilityRole="header">
              {g.bucket}
            </Text>
          </View>
          {g.categories.map((c) => (
            <View key={c.category} style={{ gap: spacing.sm }} testID={`faq-category-${bucketSlug(c.category)}`}>
              {subHeader(c.category, c.items.length)}
              {rows(c.items)}
            </View>
          ))}
        </View>
      ))}
    </View>
  );

  const searchView =
    results.length === 0 ? (
      <View style={{ gap: spacing.md }} testID="faq-no-match">
        <EmptyState icon="search" title="No answers match" message="Try different words, browse the topics or ask our support team." />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' }}>
          <Button title="Clear search" icon="x" variant="secondary" onPress={() => setQuery('')} testID="faq-clear-search" />
          <Button title="Browse topics" icon="layout-grid" variant="secondary" onPress={() => selectBucket(null)} testID="faq-browse-topics" />
          <Button title="Ask support in Live Chat" icon="chat" onPress={() => router.push(routes.admin.helpLiveChat)} testID="faq-ask-support" />
        </View>
      </View>
    ) : (
      <View style={{ gap: spacing.md }} testID="faq-results">
        <Text variant="caption" color="textMuted" testID="faq-result-count">
          {results.length} {results.length === 1 ? 'result' : 'results'}
        </Text>
        {rows(results, { highlight: words, chips: true })}
      </View>
    );

  const desktopNav = (
    <View style={[{ width: 264, gap: spacing.xs, alignSelf: 'flex-start' }, { position: 'sticky', top: spacing.lg } as object]} accessibilityRole="tablist" testID="faq-nav">
      <NavItem label="All questions" count={all.length} selected={!bucket} onPress={() => selectBucket(null)} testID="faq-nav-all" icon={null} />
      {buckets.map((b) => (
        <NavItem key={b.name} label={b.name} count={b.count} selected={bucket === b.name} onPress={() => selectBucket(b.name)} testID={`faq-nav-${bucketSlug(b.name)}`} icon={b.name} />
      ))}
    </View>
  );

  const content = searching ? searchView : bucket ? bucketView : isDesktop ? everything : tiles;

  return (
    <Screen
      title={drilled ? (bucket ?? 'FAQ') : 'FAQ'}
      subtitle={drilled ? questionsLabel(bucketItems.length) : 'Answers to common questions'}
      onBack={drilled ? () => selectBucket(null) : undefined}
      refreshing={refreshing}
      onRefresh={onRefresh}
      maxWidth={isDesktop ? 1100 : undefined}
      testID="faq-screen"
    >
      <View style={{ gap: spacing.lg }}>
        {faqs.isLoading ? (
          <SkeletonList count={5} />
        ) : faqs.isError ? (
          <ErrorState message={getErrorMessage(faqs.error, 'Failed to load the FAQs')} onRetry={() => void faqs.refetch()} />
        ) : all.length === 0 ? (
          <EmptyState icon="help-circle" title="No FAQs yet" message="Answers to common questions will appear here as soon as they are added." />
        ) : (
          <>
            <SearchBar value={query} onChangeText={setQuery} placeholder="Search all questions" accessibilityLabel="Search the FAQ" testID="faq-search" />
            {isDesktop ? (
              <View style={{ flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' }}>
                {desktopNav}
                <View style={{ flex: 1, minWidth: 0, gap: spacing.lg }}>{content}</View>
              </View>
            ) : (
              content
            )}
          </>
        )}
        {faqs.isLoading ? null : help}
      </View>
    </Screen>
  );
}
