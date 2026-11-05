import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { EmptyState, ErrorState, IconButton, ImageViewer, SkeletonList, Text } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { radii, spacing, useTheme } from '@/theme';
import type { ChatItem } from '../types';
import type { ChatThemeColors } from '../utils/chatThemes';
import { buildRows, filterItems, type MessageRow } from '../utils/rows';
import { MessageBubble } from './MessageBubble';

const NEAR_BOTTOM_PX = 140;
/** Content-size stability window after opening (or searching) before the initial pin-to-latest ends. */
const SETTLE_MS = 350;

export interface MessageListProps {
  items: ChatItem[];
  isLoading: boolean;
  error: unknown;
  onReload: () => void;
  /** In-chat search query ('' = off). */
  search?: string;
  /** Group chats show sender names above incoming bubbles. */
  showSender?: boolean;
  theme?: ChatThemeColors;
  onRetry: (clientId: string) => void;
  onDiscard: (clientId: string) => void;
  emptyTitle?: string;
  emptyMessage?: string;
}

/**
 * Conversation body: messages with date separators, scrolls to the latest message when opened, keeps following new
 * messages only while the user is at the bottom (scrolling up or searching is never interrupted), image viewer.
 */
export function MessageList({ items, isLoading, error, onReload, search = '', showSender, theme, onRetry, onDiscard, emptyTitle, emptyMessage }: MessageListProps) {
  const { colors } = useTheme();
  const listRef = useRef<FlatList<MessageRow>>(null);
  const initialScrollDone = useRef(false);
  const nearBottom = useRef(true);
  const previousCount = useRef(0);
  const [showLatest, setShowLatest] = useState(false);
  const [viewer, setViewer] = useState<{ uri: string; caption: string } | null>(null);

  const searching = search.trim() !== '';
  const rows = useMemo(() => buildRows(filterItems(items, search)), [items, search]);
  const lastIsMine = items.length > 0 && items[items.length - 1].fromMe;

  // a new open (or a changed search) starts at the latest message again
  useEffect(() => {
    initialScrollDone.current = false;
  }, [searching]);

  const scrollToLatest = useCallback((animated: boolean) => {
    listRef.current?.scrollToEnd({ animated });
  }, []);

  // The list virtualises (only the first rows exist when it opens), so its content keeps growing for a moment: keep
  // pinning to the end until the content size has been stable for SETTLE_MS, otherwise a long chat opens at the top.
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  const onContentSizeChange = useCallback(() => {
    if (rows.length === 0) return;
    if (!initialScrollDone.current) {
      previousCount.current = rows.length;
      scrollToLatest(false);
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => {
        initialScrollDone.current = true;
      }, SETTLE_MS);
      return;
    }
    const grew = rows.length > previousCount.current;
    previousCount.current = rows.length;
    if (grew && (nearBottom.current || lastIsMine)) scrollToLatest(true);
  }, [rows.length, lastIsMine, scrollToLatest]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distance = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    nearBottom.current = distance < NEAR_BOTTOM_PX;
    setShowLatest(distance > NEAR_BOTTOM_PX * 2);
  }, []);

  const renderItem = useCallback(
    ({ item: row }: { item: MessageRow }) =>
      row.kind === 'separator' ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
          <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: 3 }}>
            <Text variant="micro" color="textSecondary">
              {row.label}
            </Text>
          </View>
        </View>
      ) : (
        <MessageBubble
          item={row.item}
          showSender={showSender}
          theme={theme}
          onViewImage={(uri, caption) => setViewer({ uri, caption })}
          onRetry={onRetry}
          onDiscard={onDiscard}
        />
      ),
    [colors.surfaceMuted, showSender, theme, onRetry, onDiscard],
  );

  if (isLoading && items.length === 0) {
    return (
      <View style={{ flex: 1, padding: spacing.lg }} testID="messages-loading">
        <SkeletonList count={5} />
      </View>
    );
  }
  if (error && items.length === 0) {
    return <ErrorState message={getErrorMessage(error, 'Could not load messages')} onRetry={onReload} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={listRef}
        testID="message-list"
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={renderItem}
        onContentSizeChange={onContentSizeChange}
        onScroll={onScroll}
        scrollEventThrottle={64}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingVertical: spacing.md, flexGrow: 1 }}
        ListEmptyComponent={
          searching ? (
            <EmptyState compact icon="search" title="No messages found" message="Try a different word." />
          ) : (
            <EmptyState compact icon="chat" title={emptyTitle ?? 'No messages yet'} message={emptyMessage ?? 'Send the first message!'} />
          )
        }
        initialNumToRender={20}
        windowSize={11}
      />
      {showLatest ? (
        <View style={{ position: 'absolute', right: spacing.lg, bottom: spacing.md }}>
          <IconButton icon="arrow-down" variant="filled" accessibilityLabel="Scroll to latest message" onPress={() => scrollToLatest(true)} />
        </View>
      ) : null}
      <ImageViewer uri={viewer?.uri} caption={viewer?.caption} visible={!!viewer} onClose={() => setViewer(null)} />
    </View>
  );
}
