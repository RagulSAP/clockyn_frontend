import type { CountIncentive, TurnoverIncentive } from '@/types/api/payroll';
import type { FieldErrors } from '../types';
import { parsePositive, parsePositiveInt } from './numbers';
import { findDuplicate } from './templates';

const INVALID = 'Must be a valid number';

/* ------------------------------------------------------------------------------------------------ */
/* Count basis                                                                                       */
/* ------------------------------------------------------------------------------------------------ */

export interface CountFormValues {
  countUpto: string;
  nextCount: string;
  incentive: string;
}

export function countFormFromItem(item: CountIncentive | null): CountFormValues {
  if (!item) return { countUpto: '', nextCount: '', incentive: '' };
  return { countUpto: String(item.countUpto), nextCount: String(item.nextCount), incentive: String(item.eachIncentive) };
}

export interface CountValidationContext {
  items: readonly CountIncentive[];
  editing: CountIncentive | null;
}

/**
 * Count Upto and Next Count: whole numbers > 0 (decimals are rejected instead of silently truncated as in v1);
 * Each Incentive: number > 0. Each of the three values must be unique across templates.
 */
export function validateCountForm(form: CountFormValues, ctx: CountValidationContext): FieldErrors<CountFormValues> {
  const errors: FieldErrors<CountFormValues> = {};
  if (form.countUpto.trim() === '') errors.countUpto = 'Count upto is required';
  if (form.nextCount.trim() === '') errors.nextCount = 'Next count is required';
  if (form.incentive.trim() === '') errors.incentive = 'Incentive is required';
  if (errors.countUpto || errors.nextCount || errors.incentive) return errors;

  const countUpto = parsePositiveInt(form.countUpto);
  const nextCount = parsePositiveInt(form.nextCount);
  const incentive = parsePositive(form.incentive);
  if (countUpto === null) errors.countUpto = INVALID;
  if (nextCount === null) errors.nextCount = INVALID;
  if (incentive === null) errors.incentive = INVALID;
  if (countUpto === null || nextCount === null || incentive === null) return errors;

  const editingId = ctx.editing?.id;
  const dupUpto = findDuplicate(ctx.items, countUpto, (t) => t.countUpto, editingId);
  if (dupUpto) errors.countUpto = `This value already exists in Count ${dupUpto.name}`;
  const dupNext = findDuplicate(ctx.items, nextCount, (t) => t.nextCount, editingId);
  if (dupNext) errors.nextCount = `This value already exists in Count ${dupNext.name}`;
  const dupIncentive = findDuplicate(ctx.items, incentive, (t) => t.eachIncentive, editingId);
  if (dupIncentive) errors.incentive = `This value already exists in Count ${dupIncentive.name}`;
  return errors;
}

/** Parsed numbers of a valid count form; throws when invalid (callers validate first). */
export function countValues(form: CountFormValues): { countUpto: number; nextCount: number; eachIncentive: number } {
  const countUpto = parsePositiveInt(form.countUpto);
  const nextCount = parsePositiveInt(form.nextCount);
  const eachIncentive = parsePositive(form.incentive);
  if (countUpto === null || nextCount === null || eachIncentive === null) throw new Error(INVALID);
  return { countUpto, nextCount, eachIncentive };
}

/* ------------------------------------------------------------------------------------------------ */
/* Turnover basis                                                                                    */
/* ------------------------------------------------------------------------------------------------ */

export interface TurnoverFormValues {
  turnoverUpto: string;
  incentive: string;
}

export function turnoverFormFromItem(item: TurnoverIncentive | null): TurnoverFormValues {
  if (!item) return { turnoverUpto: '', incentive: '' };
  return { turnoverUpto: String(item.turnoverUpto), incentive: String(item.incentivePercent) };
}

export interface TurnoverValidationContext {
  items: readonly TurnoverIncentive[];
  editing: TurnoverIncentive | null;
}

/** Turnover amount: number > 0 and unique across templates; incentive percent: number > 0 (no upper cap, may repeat). */
export function validateTurnoverForm(form: TurnoverFormValues, ctx: TurnoverValidationContext): FieldErrors<TurnoverFormValues> {
  const errors: FieldErrors<TurnoverFormValues> = {};
  if (form.turnoverUpto.trim() === '') errors.turnoverUpto = 'Turnover upto is required';
  if (form.incentive.trim() === '') errors.incentive = 'Incentive is required';
  if (errors.turnoverUpto || errors.incentive) return errors;

  const turnover = parsePositive(form.turnoverUpto);
  const incentive = parsePositive(form.incentive);
  if (turnover === null) errors.turnoverUpto = INVALID;
  if (incentive === null) errors.incentive = INVALID;
  if (turnover === null || incentive === null) return errors;

  const duplicate = findDuplicate(ctx.items, turnover, (t) => t.turnoverUpto, ctx.editing?.id);
  if (duplicate) errors.turnoverUpto = `This value already exists in Turnover ${duplicate.name}`;
  return errors;
}

/** Parsed numbers of a valid turnover form; throws when invalid (callers validate first). */
export function turnoverValues(form: TurnoverFormValues): { turnoverUpto: number; incentivePercent: number } {
  const turnoverUpto = parsePositive(form.turnoverUpto);
  const incentivePercent = parsePositive(form.incentive);
  if (turnoverUpto === null || incentivePercent === null) throw new Error(INVALID);
  return { turnoverUpto, incentivePercent };
}
