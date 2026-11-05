// Clockyn layout primitives. Import from '@/components/layout' only.
export { Screen } from './Screen';
export type { ScreenProps, ScreenEdge } from './Screen';
export { ScreenHeader } from './ScreenHeader';
export type { ScreenHeaderProps } from './ScreenHeader';
export { Section, FormSection } from './Section';
export type { SectionProps, FormSectionProps } from './Section';
export { ResponsiveContainer } from './ResponsiveContainer';
export type { ResponsiveContainerProps } from './ResponsiveContainer';
export { ResponsiveRow } from './ResponsiveRow';
export type { ResponsiveRowProps, ResponsiveColumns } from './ResponsiveRow';
export { useBreakpoint, getBreakpoint } from '@/hooks/useBreakpoint';
export type { Breakpoint } from '@/hooks/useBreakpoint';

// App shell (owner: F3b) — role-area chrome, tab bar / sidebar, runtime bootstrap.
export { AppShell } from './AppShell';
export { TabBar } from './TabBar';
export { SidebarNav } from './SidebarNav';
export { RoleGuard } from './RoleGuard';
export { Bootstrap } from './Bootstrap';
export { BrandSplash } from './BrandSplash';
export { ComingSoonScreen } from './ComingSoon';
export { useShellNav, useIsWideShell } from './useShellNav';
export { SHELL_TABS, activeTabKey, decideCrmPress, shouldUseSidebar, variantForRole } from './shellNav';
export type { ShellTab, ShellTabKey, ShellVariant, GateDecision } from './shellNav';
