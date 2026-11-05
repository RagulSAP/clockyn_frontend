import React, { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Image } from 'expo-image';

import { BottomSheet, Icon, ListItem, Spinner, Text, stableImageKey, useToast } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { downloadAndOpen } from '@/lib/platform/files';
import { copyToClipboard } from '@/lib/platform/clipboard';
import { isHttpUrl } from '@/lib/safeUrl';
import { radii, spacing, useTheme } from '@/theme';
import { useStableUri } from '../hooks/useStableUri';
import type { ChatItem } from '../types';
import { isFileDownloaded, isImageRevealed, markFileDownloaded, markImageRevealed } from '../utils/chatSession';
import { type ChatThemeColors, resolveChatTheme } from '../utils/chatThemes';
import { bubbleTime, displayFileName, extensionOf, resolveMessageKind } from '../utils/format';
import { MessageStatus } from './MessageStatus';

const IMAGE_SIZE = 232;

export interface MessageBubbleProps {
  item: ChatItem;
  /** Group chats: show the sender's name above incoming bubbles. */
  showSender?: boolean;
  /** Colour theme (group chats); defaults to the app theme. */
  theme?: ChatThemeColors;
  onViewImage: (uri: string, caption: string) => void;
  onRetry: (clientId: string) => void;
  onDiscard: (clientId: string) => void;
}

/** Message bubble: text, image (tap to view / zoom), video tile or file card, with time, ticks and failed / retry. */
export function MessageBubble({ item, showSender, theme, onViewImage, onRetry, onDiscard }: MessageBubbleProps) {
  const { colors } = useTheme();
  const toast = useToast();
  const palette = theme ?? resolveChatTheme(0, colors);
  const mine = item.fromMe;
  const kind = resolveMessageKind({ type: item.type, fileUrl: item.fileUrl, text: item.text });
  const remoteUrl = item.fileUrl;
  const mediaUri = useStableUri(item.localUri ?? remoteUrl);
  const [menuOpen, setMenuOpen] = useState(false);
  const time = bubbleTime(item.sentAt);

  const bubbleBg = mine ? palette.myBubble : palette.otherBubble;
  const textColor = mine ? palette.myText : palette.otherText;
  const meta = textColor;

  const hasMenu = item.state === 'sent' && (kind === 'text' ? item.text !== '' : !!remoteUrl);

  const longPress = hasMenu ? () => setMenuOpen(true) : undefined;

  const copyText = useCallback(async () => {
    setMenuOpen(false);
    const ok = await copyToClipboard(item.text);
    if (ok) toast.success('Message copied');
    else toast.error('Could not copy the message');
  }, [item.text, toast]);

  return (
    <View style={{ width: '100%', alignItems: mine ? 'flex-end' : 'flex-start', paddingHorizontal: spacing.md, marginVertical: 2 }}>
      <View style={{ maxWidth: '82%' }}>
        {showSender && !mine ? (
          <Text variant="micro" weight="bold" color="primary" style={{ marginBottom: 2, marginLeft: spacing.sm }} numberOfLines={1}>
            {item.senderName || 'Unknown'}
          </Text>
        ) : null}

        <View style={{ opacity: item.state === 'sending' ? 0.85 : 1 }}>
          {kind === 'image' ? (
            <ImageContent item={item} uri={mediaUri} time={time} onOpen={(uri) => onViewImage(uri, item.text)} onLongPress={longPress} />
          ) : (
            <Pressable
              onLongPress={longPress}
              delayLongPress={300}
              disabled={!longPress}
              accessibilityRole={kind === 'text' ? 'text' : undefined}
              style={{
                backgroundColor: bubbleBg,
                borderRadius: radii.md,
                borderBottomRightRadius: mine ? radii.xs : radii.md,
                borderBottomLeftRadius: mine ? radii.md : radii.xs,
                borderWidth: mine ? 0 : 1,
                borderColor: colors.border,
                paddingHorizontal: spacing.md,
                paddingTop: spacing.sm,
                paddingBottom: spacing.xs + 2,
                gap: 2,
                minWidth: 88,
              }}
            >
              {kind === 'text' ? (
                <Text color={textColor} selectable>
                  {item.text}
                </Text>
              ) : kind === 'video' ? (
                <VideoContent url={remoteUrl} color={textColor} onLongPress={longPress} />
              ) : (
                <FileContent item={item} color={textColor} onLongPress={longPress} />
              )}
              <MessageStatus item={item} time={time} meta={meta} readColor={isLightColor(bubbleBg) ? textColor : undefined} />
            </Pressable>
          )}
        </View>

        {item.state === 'failed' && item.clientId ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: mine ? 'flex-end' : 'flex-start', gap: spacing.sm, marginTop: 4 }}>
            <Icon name="alert-circle" size={14} color="danger" />
            <Text variant="caption" color="danger">
              Failed to send
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Retry sending" onPress={() => onRetry(item.clientId as string)} hitSlop={8}>
              <Text variant="caption" weight="bold" color="primary">
                Retry
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Discard message" onPress={() => onDiscard(item.clientId as string)} hitSlop={8}>
              <Text variant="caption" color="textMuted">
                Discard
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)} snap="auto" size="sm">
        {kind === 'text' ? <ListItem title="Copy" icon="copy" onPress={() => void copyText()} /> : null}
        {kind !== 'text' && remoteUrl ? (
          <ListItem
            title="Download"
            icon="download"
            onPress={() => {
              setMenuOpen(false);
              void openAttachment(remoteUrl, item.text, toast.error);
            }}
          />
        ) : null}
      </BottomSheet>
    </View>
  );
}

async function openAttachment(url: string, name: string, onError: (message: string) => unknown): Promise<boolean> {
  try {
    await downloadAndOpen({ url, filename: displayFileName(name || url) });
    markFileDownloaded(url);
    return true;
  } catch (e) {
    onError(getErrorMessage(e, 'Could not open the file'));
    return false;
  }
}

function ImageContent({ item, uri, time, onOpen, onLongPress }: { item: ChatItem; uri: string | null; time: string; onOpen: (uri: string) => void; onLongPress?: () => void }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const url = item.fileUrl;
  const [revealed, setRevealed] = useState(() => item.fromMe || !url || isImageRevealed(url));
  const sending = item.state === 'sending';

  const press = () => {
    if (!uri) return;
    if (!revealed) {
      if (url) markImageRevealed(url);
      setRevealed(true);
      return;
    }
    onOpen(uri);
  };

  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={revealed ? 'Open photo' : 'Tap to view photo'}
      onPress={press}
      onLongPress={onLongPress}
      delayLongPress={300}
      disabled={!uri || sending}
    >
      <View style={{ width: IMAGE_SIZE, height: IMAGE_SIZE, borderRadius: radii.md, overflow: 'hidden', backgroundColor: colors.surfaceMuted }}>
        {uri && !failed ? (
          <Image
            source={{ uri, cacheKey: stableImageKey(uri) }}
            style={{ width: IMAGE_SIZE, height: IMAGE_SIZE }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={120}
            recyclingKey={item.key}
            onError={() => setFailed(true)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs }}>
            <Icon name="image" size={32} color="textMuted" />
            <Text variant="caption" color="textMuted">
              {failed ? 'Photo unavailable' : 'Photo'}
            </Text>
          </View>
        )}
        {!revealed ? (
          <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', gap: spacing.xs }}>
            <Icon name="download" size={26} color="onGradient" />
            <Text variant="callout" weight="semibold" color="onGradient">
              Tap to view
            </Text>
          </View>
        ) : null}
        {sending ? (
          <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', gap: spacing.xs }}>
            <Spinner color="onGradient" />
            <Text variant="caption" color="onGradient">
              {typeof item.progress === 'number' ? `${Math.round(item.progress)}%` : 'Uploading'}
            </Text>
          </View>
        ) : null}
        <View
          style={{
            position: 'absolute',
            right: spacing.sm,
            bottom: spacing.sm,
            backgroundColor: colors.overlay,
            borderRadius: radii.pill,
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
          }}
        >
          <MessageStatus item={item} time={time} meta={colors.onGradient} />
        </View>
      </View>
    </Pressable>
  );
}

function VideoContent({ url, color, onLongPress }: { url: string | null; color: string; onLongPress?: () => void }) {
  const { colors } = useTheme();
  const toast = useToast();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Play video"
      onLongPress={onLongPress}
      disabled={!isHttpUrl(url)}
      onPress={() => {
        if (isHttpUrl(url)) Linking.openURL(url).catch((e: unknown) => toast.error(getErrorMessage(e, 'Could not open the video')));
      }}
      style={{ width: 220, height: 132, borderRadius: radii.sm, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', gap: spacing.xs }}
    >
      <Icon name="play" size={30} color={color} />
      <Text variant="caption" color={color}>
        Tap to play
      </Text>
    </Pressable>
  );
}

function FileContent({ item, color, onLongPress }: { item: ChatItem; color: string; onLongPress?: () => void }) {
  const toast = useToast();
  const url = item.fileUrl;
  const [busy, setBusy] = useState(false);
  const [downloaded, setDownloaded] = useState(() => (url ? isFileDownloaded(url) : false));
  const name = useMemo(() => displayFileName(item.text || url), [item.text, url]);
  const ext = (extensionOf(name) || 'file').toUpperCase();
  const pending = item.state !== 'sent';

  const status = pending
    ? item.state === 'failed'
      ? 'Not sent'
      : typeof item.progress === 'number'
        ? `Uploading ${Math.round(item.progress)}%`
        : 'Uploading'
    : busy
      ? 'Downloading…'
      : item.fromMe
        ? 'Tap to open'
        : downloaded
          ? 'Downloaded · Tap to view'
          : 'Tap to download';

  const open = async () => {
    if (!url || busy || pending) return;
    setBusy(true);
    const ok = await openAttachment(url, name, toast.error);
    if (ok) setDownloaded(true);
    setBusy(false);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${status}`}
      onPress={() => void open()}
      onLongPress={onLongPress}
      disabled={!url || pending}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minWidth: 200 }}
    >
      <View style={{ width: 40, height: 40, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color }}>
        <Icon name="file-text" size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" color={color} numberOfLines={2}>
          {name}
        </Text>
        <Text variant="caption" color={color} style={{ opacity: 0.8 }}>
          {`${ext} · ${status}`}
        </Text>
      </View>
      {busy || (pending && item.state === 'sending') ? (
        <Spinner color={color} />
      ) : (
        <Icon name={item.fromMe || downloaded ? 'external-link' : 'download'} size={18} color={color} />
      )}
    </Pressable>
  );
}

/** True for a light `#rrggbb` fill (used to avoid mint read-ticks on a near-white bubble). */
function isLightColor(hex: string): boolean {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return lum > 0.4;
}
