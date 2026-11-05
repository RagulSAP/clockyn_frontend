/**
 * WebPage — WEB / default implementation: an `<iframe>` showing an external page (privacy policy, help pages).
 * Some sites forbid framing (X-Frame-Options); screens should therefore also offer an "Open in browser" action.
 * The native implementation (WebView) lives in `WebPage.native.tsx`.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

export type WebPageProps = {
  /** Absolute http(s) URL. */
  url: string;
  /** Accessible title of the frame. */
  title?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function WebPage({ url, title = 'Web page', style, testID }: WebPageProps): React.JSX.Element {
  return (
    <View testID={testID} style={[{ flex: 1, minHeight: 320, overflow: 'hidden' }, style]}>
      {React.createElement('iframe', {
        src: url,
        title,
        style: { border: 0, width: '100%', height: '100%', flex: 1, backgroundColor: 'transparent' },
        referrerPolicy: 'no-referrer',
      })}
    </View>
  );
}
