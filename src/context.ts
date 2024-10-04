import type { Issue, Path } from "./issue";

export type Message = string | (() => string);

export type ParseOptions = {
  string?: {
    /** Coerce input to string (default false) */
    coerce?: boolean;
    /** Trim strings (default true) */
    trim?: boolean;
    /* Allow empty strings (default true) */
    empty?: boolean;
  };
  number?: {
    /** Coerce strings to number (default false) */
    coerce?: boolean;
  };
  boolean?: {
    /** Coerce input to boolean (default false) */
    coerce?: boolean;
  };
  [key: string]: unknown;
};

export interface ParseContext {
  get path(): Path;
  get options(): ParseOptions;
  pathFor<P extends Record<string, any> | any[]>(proxy: P): Path;
  issue(condition: boolean, message: Message, path?: Path): Issue | undefined;
  issue(message: Message, path?: Path): Issue;
  issue(code: string, message: Message, path?: Path): Issue;
  issue(issue: { code?: string; message: Message; path?: Path }): Issue;
  isDefined<T>(path: T): path is NonNullable<T>;
  get<T>(key: string): T;
}

export class ContextKeyError extends Error {
  constructor(key: string) {
    super(`Context key missing: ${key}`);
  }
}
