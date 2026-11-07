import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ApiError } from '@/lib/api/errors';
import type { SupportVideo } from '@/types/api/support';

import { renderScreen, signInTestAdmin } from '../../settings/__tests__/testHelpers';
import SupportHubScreen from '../screens/SupportHubScreen';
import VideoHubScreen from '../screens/VideoHubScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
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
jest.mock('@/api', () => ({
  supportApi: { listSupportVideos: (...a: unknown[]) => mockListVideos(...a) },
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
  signInTestAdmin();
});

describe('SupportHubScreen', () => {
  it('offers FAQ, WhatsApp Chat and Video Hub', async () => {
    await renderScreen(<SupportHubScreen />);
    expect(screen.getByText('FAQ')).toBeTruthy();
    expect(screen.getByText('WhatsApp Chat')).toBeTruthy();
    expect(screen.getByText('Video Hub')).toBeTruthy();
  });

  it('opens the admin Video Hub for the owner and the staff one for staff', async () => {
    await renderScreen(<SupportHubScreen />);
    await fireEvent.press(screen.getByTestId('support-video-hub'));
    expect(mockPush).toHaveBeenLastCalledWith('/admin/help/videos');

    signInTestAdmin({ roleId: 3 });
    await renderScreen(<SupportHubScreen />);
    await fireEvent.press(screen.getAllByTestId('support-video-hub').at(-1)!);
    expect(mockPush).toHaveBeenLastCalledWith('/staff/help/videos');
  });

  it('says FAQ and WhatsApp chat are coming soon instead of navigating', async () => {
    await renderScreen(<SupportHubScreen />);
    await fireEvent.press(screen.getByTestId('support-faq'));
    expect(await screen.findByText('FAQ is coming soon')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
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
