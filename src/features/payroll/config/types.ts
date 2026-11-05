import type React from 'react';
import type { IconName } from '@/components/ui';
import type { AssignableStaff, AssignmentSide } from '@/types/api/payroll';
import type { FieldErrors, PayrollKind } from '../types';
import type { TemplateBase } from '../utils/templates';

/** Handle given to a type's form-field renderer. */
export interface FormApi<F extends object> {
  values: F;
  errors: FieldErrors<F>;
  /** Sets one field (does not touch its error). */
  setValue: <K extends keyof F & string>(key: K, value: F[K]) => void;
  /** Sets / clears the inline error of one field (live validation). */
  setError: (key: keyof F & string, message: string) => void;
  disabled: boolean;
}

/** Copy of the toasts shown after write actions. */
export interface TemplateMessages {
  saved: string;
  updated: string;
  deleted: string;
  saveFailed: string;
  deleteFailed: string;
}

export interface SaveArgs<T extends TemplateBase, F extends object> {
  orgId: string;
  form: F;
  editing: T | null;
  items: readonly T[];
  /** Auto-number for a new template (highest numeric name + 1). */
  nextName: string;
}

export interface TemplateApi<T extends TemplateBase> {
  list: (orgId: string) => Promise<T[]>;
  remove: (id: string) => Promise<void>;
  listStaff: (orgId: string, templateId: string, side: AssignmentSide) => Promise<AssignableStaff[]>;
  assign: (orgId: string, userIds: string[], templateId: string) => Promise<void>;
  unassign: (orgId: string, userId: string, templateId: string) => Promise<void>;
}

export interface AssignConfig<T extends TemplateBase> {
  /** Modal title: "Assign Staff" (bonus: "Staff Details"). */
  title: string;
  /** One-line note under the title (e.g. the server's "moves staff off their other template" rule). */
  hint?: string;
  /** Ids of staff that should trigger the "already assigned" confirmation before being selected. */
  loadWarnIds?: (orgId: string, items: readonly T[]) => Promise<string[]>;
  /** Warning dialog copy for one staff name. */
  warnTitle?: string;
  warnMessage?: (staffName: string) => string;
}

/**
 * Everything that differs between the six "numbered template" screens (daily wages, hourly charges, overtime, bonus,
 * count basis, turnover basis). `TemplateListScreen` renders the shared page from one of these.
 */
export interface TemplateTypeConfig<T extends TemplateBase, F extends object> {
  kind: PayrollKind;
  /** Screen title ("Daily Wages"). */
  title: string;
  /** Header button label ("Add", "Add OT", ...). */
  addLabel: string;
  /** List section label ("All Daily Wages"). */
  listLabel: string;
  icon: IconName;
  /** Card title ("Day Pay 3"). */
  itemTitle: (item: T, index: number) => string;
  /** Form dialog title for a new template (`nextName` is the auto number) or an existing one. */
  formTitle: (editing: T | null, nextName: string) => string;
  /** Inline delete-confirmation text. */
  deleteConfirm: string;
  /** Right side of the card header (amount / percent / duration chips). */
  renderBadges: (item: T) => React.ReactNode;
  /** Detail lines under the card header (optional). */
  renderDetails?: (item: T) => React.ReactNode;
  messages: TemplateMessages;
  /** Scrim tap / back closes the form dialog (only daily wages in v1; everywhere else Cancel is required). */
  formDismissible?: boolean;
  initialForm: (editing: T | null) => F;
  fields: (api: FormApi<F>) => React.ReactNode;
  validate: (form: F, ctx: { items: readonly T[]; editing: T | null }) => FieldErrors<F>;
  save: (args: SaveArgs<T, F>) => Promise<void>;
  api: TemplateApi<T>;
  assign: AssignConfig<T>;
}
