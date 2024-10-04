import type { BaseType, ChildKey, LiteralKey, ParsedInput } from "./base";
import {
  ContextKeyError,
  type Message,
  type ParseContext,
  type ParseOptions,
} from "./context";
import type { Issue, Path } from "./issue";
import { isObject, toParsedInput } from "./util";

const getMessage = (msg: Message) => (typeof msg === "function" ? msg() : msg);

export const internalContext = (ctx: ParseContext) =>
  ctx as ParseContextInternal;

export const internalType = <T extends BaseType>(type: T) => {
  return type as unknown as InternalType;
};

const pathSymbol = Symbol("path");

export interface InternalType {
  get isOptional(): boolean;
  get isNullable(): boolean;
  get defaultValue(): unknown;
  get isLiteral(): boolean;
  get literalValue(): string | number | boolean;
  get hasAsyncValidators(): boolean;
  parseInput<T>(ctx: ParseContext, input: unknown): T;
  getLiteralKeys(): LiteralKey[];
  getChildKeys(value: unknown): ChildKey[];
  validate(ctx: ParseContext, value: unknown): void;
  validateAsync(ctx: ParseContext, value: unknown): Promise<void>;
  getExtensionParams(name: string): any[] | undefined;
}

export class ParseContextInternal implements ParseContext {
  private _path = [] as Path;
  private inputs = new Map<
    string,
    { value: unknown; parsed: boolean; type: BaseType }
  >();
  private issues = new Set<Issue>();

  constructor(readonly options: ParseOptions) {}

  get path(): Path {
    return [...this._path];
  }

  get pathHasErrors() {
    const key = this._path.join(".");
    return this.inputs.get(key)?.parsed !== true;
  }

  pathFor<P extends Record<string, any> | any[]>(proxy: P): Path {
    if (typeof proxy === "object") {
      return (proxy as any)[pathSymbol] ?? [];
    }
    return [];
  }

  isDefined<T>(path: T): path is NonNullable<T> {
    const key = this._path.join(".");
    return this.inputs.get(key)?.value != null;
  }

  private setPath(path: Path) {
    this._path = path;
  }

  get issueCount() {
    return this.issues.size;
  }

  getIssues() {
    return [...this.issues];
  }

  addIssues(issues: Issue[]) {
    for (const issue of issues) {
      this.issues.add(issue);
    }
  }

  removeIssues(issues: Issue[]) {
    for (const issue of issues) {
      this.issues.delete(issue);
    }
  }

  setInput(input: unknown, parsed: boolean, type: BaseType) {
    const key = this._path.join(".");
    this.inputs.set(key, { value: input, parsed: parsed, type });
  }

  clone() {
    const clone = Object.create(this) as this;
    clone.setPath(this.path);
    clone.inputs = new Map(this.inputs);
    clone.issues = new Set(this.issues);
    return clone;
  }

  withChildPath<T>(key: string | number, callback: () => T) {
    const path = this.path;
    try {
      this.setPath([...path, key]);
      return callback();
    } finally {
      this.setPath(path);
    }
  }

  async withChildPathAsync<T>(
    key: string | number,
    callback: () => Promise<T>,
  ) {
    const path = this.path;
    try {
      this.setPath([...path, key]);
      return await callback();
    } finally {
      this.setPath(path);
    }
  }

  withProxy<T>(data: T, callback: (data: T, resetPath: () => void) => void) {
    const path = this.path;
    const resetPath = () => {
      this.setPath(path);
    };
    const proxy = this.getProxy(data);

    try {
      callback(proxy, resetPath);
    } finally {
      resetPath();
    }
  }

  async withProxyAsync<T>(
    data: T,
    callback: (data: T, resetPath: () => void) => Promise<void>,
  ) {
    const path = this.path;
    const resetPath = () => {
      this.setPath(path);
    };
    const proxy = this.getProxy(data);

    try {
      await callback(proxy, resetPath);
    } finally {
      resetPath();
    }
  }

  private getProxy<T>(data: T) {
    const paths = new Map<object, Path>(); // proxy => path
    const proxies = new Map<string, object>(); // path => proxy

    const keyOrIndex = (prop: any) => {
      const num = Number.parseInt(prop);
      return !Number.isNaN(num) ? num : prop;
    };

    const tryGetProxy = (value: any, path: Path) => {
      if (!isObject(value) && !Array.isArray(value)) {
        return value;
      }

      const key = path.join(".");
      if (proxies.has(key)) {
        return proxies.get(key)!;
      }

      const proxy = new Proxy(value, handler);
      paths.set(proxy, path);
      proxies.set(key, proxy);
      return proxy;
    };

    const handler: any = {
      get: (target: any, prop: string | number | symbol, receiver: any) => {
        if (prop === pathSymbol) {
          return paths.get(receiver);
        }

        const value = target[prop];

        const isIterator =
          (prop === Symbol.iterator || prop === "values") &&
          typeof value === "function";

        // custom iterator to explicitly track item access
        if (isIterator) {
          return function* (this: any) {
            for (let i = 0; i < target.length; ++i) {
              yield this[i];
            }
          };
        }

        const proxyPath = paths.get(receiver)!;
        const childPath = [...proxyPath, keyOrIndex(prop)];
        const isArrayLength = Array.isArray(target) && prop === "length";
        this.setPath(isArrayLength ? proxyPath : childPath);

        return tryGetProxy(value, childPath);
      },
    };

    return tryGetProxy(data, this.path) as T;
  }

  issue(condition: boolean, message: Message, path?: Path): Issue | undefined;
  issue(message: Message, path?: Path): Issue;
  issue(code: string, message: Message, path?: Path): Issue;
  issue(issue: { code: string; message: Message; path?: Path }): Issue;
  issue(...args: any[]): Issue | undefined {
    if (typeof args[0] === "boolean") {
      if (args[0] === true) {
        return this.issue.apply(this, args.slice(1) as any);
      }
      return;
    }
    const first = args[0] as
      | string
      | Message
      | { code: string; message: Message; path?: Path };
    const second = args[1] as Message | Path | undefined;
    const third = args[2] as Path | undefined;

    if (typeof first === "object" && this.issues.has(first as Issue)) {
      return first as Issue;
    }
    const path =
      third ??
      (Array.isArray(second)
        ? second
        : typeof first === "object"
          ? first.path
          : undefined);
    const code =
      typeof first === "function"
        ? "custom"
        : typeof first === "string"
          ? second == null || Array.isArray(second)
            ? "custom"
            : first
          : first.code;
    const message =
      typeof first === "function"
        ? first()
        : typeof first === "string"
          ? second == null || Array.isArray(second)
            ? first
            : getMessage(second)
          : getMessage(first.message);
    const issue = {
      path: path ?? this.path,
      code,
      message,
    };
    this.issues.add(issue);
    return issue;
  }

  get<T>(key: string): T {
    const value = this.options[key];
    if (value == null) {
      throw new ContextKeyError(key);
    }
    return value as T;
  }

  getParsedInput<T>(value: T) {
    const issues = new Map<string, Issue[]>();

    for (const issue of this.issues) {
      const key = issue.path.join(".");
      let list = issues.get(key);
      if (!list) {
        list = [];
        issues.set(key, list);
      }
      list.push(issue);
    }

    const getInput = (path: Path) => {
      const key = path.join(".");
      const { value, parsed } = this.inputs.get(key) ?? {};
      return {
        value,
        parsed: parsed ?? false,
        issues: issues.get(key) ?? [],
      };
    };

    return toParsedInput(value, getInput) as ParsedInput<T>;
  }
}

/**
 * Internal context decorator that tracks new issues, used to override issues
 */
export class IssueTrackingContext implements ParseContext {
  readonly newIssues = new Set<Issue>();

  constructor(private ctx: ParseContext) {}

  get path() {
    return this.ctx.path;
  }
  get options(): ParseOptions {
    return this.ctx.options;
  }
  pathFor<P extends Record<string, any> | any[]>(proxy: P) {
    return this.ctx.pathFor(proxy);
  }
  issue(...args: any[]): Issue {
    const newIssue = this.ctx.issue.apply(this.ctx, args as any);
    this.newIssues.add(newIssue);
    return newIssue;
  }
  isDefined<T>(path: T) {
    return this.ctx.isDefined(path);
  }
  get<T>(key: string) {
    return this.ctx.get<T>(key);
  }
}
