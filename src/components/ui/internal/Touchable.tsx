import React, { forwardRef, useCallback } from 'react';
import { Pressable, type PressableProps, type PressableStateCallbackType, type HostInstance, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { focusRing, isKeyboardFocus } from './web';

export type TouchState = { pressed: boolean; hovered: boolean; focused: boolean; keyboardFocused: boolean };

export type TouchableProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle> | ((state: TouchState) => StyleProp<ViewStyle>);
  children?: React.ReactNode | ((state: TouchState) => React.ReactNode);
  /** Extra style while hovered (web / pointer devices). */
  hoverStyle?: StyleProp<ViewStyle>;
  /** Extra style while pressed. Defaults to a subtle opacity dip. */
  pressedStyle?: StyleProp<ViewStyle>;
  /** Border radius used for the keyboard focus ring. */
  radius?: number;
  /** Disable the keyboard focus ring (when the child draws its own). */
  noFocusRing?: boolean;
  /** Web only: also activate on Space (RN web only wires Enter for non-button roles). */
  activateOnSpace?: boolean;
};

type StateArg = PressableStateCallbackType & { hovered?: boolean; focused?: boolean };

/**
 * react-native-web 0.21 ignores the legacy `accessibilityState` object, so a checked / selected / expanded control
 * exposed nothing to assistive technology (or to tests) in the web build. The state is therefore also passed as the
 * `aria-*` props both platforms understand.
 */
function ariaFromState(state: PressableProps['accessibilityState']): Record<string, boolean | 'mixed'> | null {
  if (!state) return null;
  const out: Record<string, boolean | 'mixed'> = {};
  if (state.checked !== undefined) out['aria-checked'] = state.checked;
  if (state.selected !== undefined) out['aria-selected'] = state.selected;
  if (state.expanded !== undefined) out['aria-expanded'] = state.expanded;
  if (state.busy !== undefined) out['aria-busy'] = state.busy;
  return out;
}

/**
 * Pressable with Clockyn interaction states: hover tint, pressed dip, keyboard-only focus ring on web.
 * Every tappable surface in the design system is built on this so behaviour is consistent.
 */
export const Touchable = forwardRef<HostInstance, TouchableProps>(function Touchable(
  { style, children, hoverStyle, pressedStyle, radius, noFocusRing, activateOnSpace, disabled, onPress, ...rest },
  ref,
) {
  const { colors } = useTheme();

  const resolve = useCallback(
    (s: StateArg): TouchState => ({
      pressed: !!s.pressed,
      hovered: !!s.hovered,
      focused: !!s.focused,
      keyboardFocused: isKeyboardFocus(s.focused),
    }),
    [],
  );

  const webKey = activateOnSpace && onPress && !disabled
    ? {
        onKeyDown: (e: { key?: string; preventDefault?: () => void }) => {
          if (e.key === ' ') {
            e.preventDefault?.();
            (onPress as (e: unknown) => void)(e);
          }
        },
      }
    : null;

  return (
    <Pressable
      ref={ref}
      disabled={disabled}
      onPress={onPress}
      {...rest}
      {...(ariaFromState(rest.accessibilityState) as object)}
      {...(webKey as object)}
      style={(s) => {
        const st = resolve(s as StateArg);
        const base = typeof style === 'function' ? style(st) : style;
        return [
          base,
          st.hovered && !disabled ? hoverStyle : null,
          st.pressed && !disabled ? (pressedStyle ?? { opacity: 0.82 }) : null,
          st.keyboardFocused && !noFocusRing ? focusRing(colors.primary, radius) : null,
        ];
      }}
    >
      {(s) => (typeof children === 'function' ? children(resolve(s as StateArg)) : children)}
    </Pressable>
  );
});
