import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ApiError } from '@/lib/api/errors';
import { badges, resetBadges } from '@/store/badges';
import type { SupportVideo } from '@/types/api/support';

import { renderScreen, signInTestAdmin } from '../../settings/__tests__/testHelpers';
import { videoFrameSize } from '../components/VideoPlayerModal';
import SupportHubScreen from '../screens/SupportHubScreen';
import VideoHubScreen from '../screens/VideoHubScreen';

const mockPush = jest.fn();
const mockRedirect = jest.fn();
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true },
  useRouter: () => ({ push: (...a: unknown[]) => mockPush(...a), replace: jest.fn(), back: jest.fn(), canGoBack: () => true, dismissAll: jest.fn() }),
  useFocusEffect: () => undefined,
  useLocalSearchParams: () => ({}),
}));

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockListVideos = jest.fn();
const mockRecordView = jest.fn();
jest.mock('@/api', () => ({
  supportApi: {
    listSupportVideos: (...a: unknown[]) => mockListVideos(...a),
    recordVideoView: (...a: unknown[]) => mockRecordView(...a),
  },
}));

jest.mock('expo-video', () => {
  const { View } = jest.requireActual('react-native');
  const ReactActual = jest.requireActual('react');
  return {
    useVideoPlayer: () => ({ status: 'loading', play: jest.fn(), addListener: () => ({ remove: jest.fn() }) }),
    VideoView: () => ReactActual.createElement(View, { testID: 'video-view' }),
  };
});

const video = (id: string, name: string): SupportVideo => ({ id, name, url: `https://bucket.example.com/guide/${id}.mp4?sig=1` });

beforeEach(() => {
  jest.clearAllMocks();
  mockRecordView.mockResolvedValue(undefined);
  resetBadges();
  signInTestAdmin();
});

describe('SupportHubScreen', () => {
  it('offers FAQ, Live Chat and Video Hub (no more WhatsApp chat)', async () => {
    await renderScreen(<SupportHubScreen />);
    expect(screen.getByText('FAQ')).toBeTruthy();
    expect(screen.getByText('Live Chat')).toBeTruthy();
    expect(screen.getByText('Chat with our support team')).toBeTruthy();
    expect(screen.getByText('Video Hub')).toBeTruthy();
    expect(screen.queryByText('WhatsApp Chat')).toBeNull();
  });

  it('opens the Video Hub and Live Chat', async () => {
    await renderScreen(<SupportHubScreen />);
    await fireEvent.press(screen.getByTestId('support-video-hub'));
    expect(mockPush).toHaveBeenLastCalledWith('/admin/help/videos');
    await fireEvent.press(screen.getByTestId('support-live-chat'));
    expect(mockPush).toHaveBeenLastCalledWith('/admin/help/live-chat');
  });

  it('shows the unread support messages on the Live Chat row', async () => {
    badges.set('liveChat', 4);
    await renderScreen(<SupportHubScreen />);
    expect(screen.getByTestId('support-live-chat-badge')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('shows no badge when nothing is unread', async () => {
    await renderScreen(<SupportHubScreen />);
    expect(screen.queryByTestId('support-live-chat-badge')).toBeNull();
  });

  it('opens the FAQ screen from the FAQ row, with no "Soon" badge', async () => {
    await renderScreen(<SupportHubScreen />);
    expect(screen.queryByText('Soon')).toBeNull();
    expect(screen.getByText('Answers to common questions')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('support-faq'));
    expect(mockPush).toHaveBeenLastCalledWith('/admin/help/faq');
    expect(screen.queryByText('FAQ is coming soon')).toBeNull();
  });

  it.each([2, 3])('sends role %i away: the Support hub is for the admin only', async (roleId) => {
    signInTestAdmin({ roleId: roleId as 2 | 3 });
    await renderScreen(<SupportHubScreen />);
    expect(mockRedirect).toHaveBeenCalledWith('/staff/home');
    expect(screen.queryByText('Live Chat')).toBeNull();
  });
});

describe('Video Hub access', () => {
  it.each([2, 3])('sends role %i away', async (roleId) => {
    signInTestAdmin({ roleId: roleId as 2 | 3 });
    mockListVideos.mockResolvedValue([video('1', 'Getting started')]);
    await renderScreen(<VideoHubScreen />);
    expect(mockRedirect).toHaveBeenCalledWith('/staff/home');
    expect(screen.queryByText('Video Hub')).toBeNull();
    expect(mockListVideos).not.toHaveBeenCalled();
  });
});

describe('videoFrameSize', () => {
  it('fits a portrait phone recording inside a narrow card that keeps its shape', () => {
    const { width, height } = videoFrameSize(390, 844, 47, 34, 9 / 16);
    expect(width).toBeLessThanOrEqual(390 - 32);
    expect(Math.abs(width / height - 9 / 16)).toBeLessThan(0.01);
    expect(height).toBeLessThan(844 - 47 - 34); // leaves room for the header and the margins
  });

  it('keeps the card to a comfortable width on a wide window', () => {
    expect(videoFrameSize(1400, 900, 0, 0, 9 / 16).width).toBeLessThanOrEqual(400);
    expect(videoFrameSize(1400, 900, 0, 0, 16 / 9).width).toBeLessThanOrEqual(760);
  });

  it('makes a landscape video wider than tall, and survives a missing size', () => {
    const landscape = videoFrameSize(390, 844, 0, 0, 16 / 9);
    expect(landscape.width).toBeGreaterThan(landscape.height);
    expect(videoFrameSize(390, 844, 0, 0, Number.NaN).width).toBeGreaterThan(0);
  });
});

describe('VideoHubScreen', () => {
  it('lists the videos the server returns', async () => {
    mockListVideos.mockResolvedValue([video('1', 'Getting started'), video('2', 'Mark attendance')]);
    await renderScreen(<VideoHubScreen />);
    expect(await screen.findByText('Getting started')).toBeTruthy();
    expect(screen.getByText('Mark attendance')).toBeTruthy();
  });

  it('plays a video full screen and closes it again', async () => {
    mockListVideos.mockResolvedValue([video('1', 'Getting started')]);
    await renderScreen(<VideoHubScreen />);
    await fireEvent.press(await screen.findByTestId('video-1'));
    expect(await screen.findByTestId('video-player')).toBeTruthy();
    expect(screen.getByTestId('video-view')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('video-player-close'));
    await waitFor(() => expect(screen.queryByTestId('video-player')).toBeNull());
  });

  it('closes the video when the dimmed backdrop outside the card is tapped', async () => {
    mockListVideos.mockResolvedValue([video('1', 'Getting started')]);
    await renderScreen(<VideoHubScreen />);
    await fireEvent.press(await screen.findByTestId('video-1'));
    expect(await screen.findByText('Guide video')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('video-player-backdrop'));
    await waitFor(() => expect(screen.queryByTestId('video-player')).toBeNull());
  });

  it('records which user of which organisation opened the video', async () => {
    mockListVideos.mockResolvedValue([video('7', 'Mark attendance')]);
    await renderScreen(<VideoHubScreen />);
    await fireEvent.press(await screen.findByTestId('video-7'));
    expect(mockRecordView).toHaveBeenCalledWith('7', { userId: 'user-1', orgId: 'org-1' });
  });

  it('still plays the video when the view cannot be recorded', async () => {
    mockRecordView.mockRejectedValue(new Error('offline'));
    mockListVideos.mockResolvedValue([video('7', 'Mark attendance')]);
    await renderScreen(<VideoHubScreen />);
    await fireEvent.press(await screen.findByTestId('video-7'));
    expect(await screen.findByTestId('video-player')).toBeTruthy();
  });

  it('shows an empty state when there are no active videos', async () => {
    mockListVideos.mockResolvedValue([]);
    await renderScreen(<VideoHubScreen />);
    expect(await screen.findByText('No videos yet')).toBeTruthy();
  });

  it('shows the error and retries', async () => {
    mockListVideos.mockRejectedValueOnce(new ApiError({ status: 500, detail: 'Could not load videos' }));
    mockListVideos.mockResolvedValueOnce([video('1', 'Getting started')]);
    await renderScreen(<VideoHubScreen />);
    expect(await screen.findByText('Could not load videos')).toBeTruthy();
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Getting started')).toBeTruthy();
  });
});
