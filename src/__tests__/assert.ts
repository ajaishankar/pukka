import { expect } from "vitest";
import type { ParseFailure, ParseResult, ParseSuccess } from "../base";

export function assertSuccess<T>(
  result: ParseResult<T>,
): asserts result is ParseSuccess<T> {
  expect(result.success).toBe(true);
}

export function assertFail<T>(
  result: ParseResult<T>,
): asserts result is ParseFailure<T> {
  expect(result.success).toBe(false);
}
