import {
  ContextKeyError,
  type ParseContext,
  type ParseOptions,
} from "./context";
import { IssueTrackingContext, internalType } from "./internal";
import { ParseContextInternal, internalContext } from "./internal";
import { CORE_ISSUES, type Issue, type Path, isIssue } from "./issue";
import { type Simplify, isObject } from "./util";

const { invalid_type, required, exception } = CORE_ISSUES;

export type ValidationResult = Issue | unknown;

export type ValidationResultOverride<T = unknown> =
  | string
  | ((ctx: ParseContext, value: T) => string | Issue);

export type Validator<T> = (
  ctx: Omit<ParseContext, "options">,
  value: T,
) => ValidationResult;

export type AsyncValidator<T> = (
  ctx: Omit<ParseContext, "options">,
  value: T,
) => Promise<ValidationResult>;

type IsOptional = { isOptional: true };

type IsNullable = { isNullable: true };

type InferOptional<T> =
  | (T extends IsOptional ? undefined : never)
  | (T extends IsNullable ? null : never);

export type Infer<S> = S extends Record<string, BaseType>
  ? {
      [K in keyof S]: Infer<S[K]>;
    }
  : S extends (infer I)[]
    ? Infer<I>[]
    : S extends Type<infer T>
      ? T | Simplify<InferOptional<S>>
      : never;

export type ParsedInputValue<T> = {
  parsed: T | undefined;
  value: any;
  issues: Omit<Issue, "path">;
};

export type ParsedInput<T, N = NonNullable<T>> = N extends Record<string, any>
  ? {
      [K in keyof N]-?: ParsedInput<N[K]>;
    } & { issues: Omit<Issue, "path"> }
  : N extends any[]
    ? ParsedInput<N[number]>[] & { issues: Omit<Issue, "path"> }
    : ParsedInputValue<T>;

export type CoreIssueOverrides = {
  invalid_type_error?: ValidationResultOverride;
  required_error?: ValidationResultOverride;
};

export type MessageOverride = {
  message: ValidationResultOverride;
};

export type ParseSuccess<T> = {
  success: true;
  data: T;
  input: undefined;
  issues: undefined;
};

export type ParseFailure<T> = {
  success: false;
  data: undefined;
  input: ParsedInput<T>;
  issues: Issue[];
};

export type ParseResult<T> = ParseSuccess<T> | ParseFailure<T>;

export type LiteralKey = {
  key: string | number;
  value: string | number | boolean;
  type: BaseType;
};

export type ChildKey = {
  key: string | number;
  type: BaseType;
};

export type Get<T, P extends Path> = P extends []
  ? T
  : P extends [infer K, ...infer R extends Path]
    ? K extends keyof T
      ? Get<T[K], R>
      : never
    : never;

export type PathType<
  B extends BaseType,
  P extends Path,
  T = Get<Infer<B>, P>,
> = [T] extends [never] ? BaseType | undefined : Type<T>;

export class ParseError extends Error {
  constructor(
    private _input: unknown,
    readonly issues: Issue[],
  ) {
    super();
  }
  input<S extends BaseType>(schema: S) {
    return this._input as ParsedInput<Infer<S>>;
  }
}

const getIssues = (result: ValidationResult) => {
  return Array.isArray(result)
    ? result.filter((res) => isIssue(res))
    : isIssue(result)
      ? [result]
      : [];
};

const tryGetCoreIssueOverride = (
  ctx: ParseContext,
  input: unknown,
  code: string,
  overrides: CoreIssueOverrides,
) => {
  if (code === invalid_type.CODE && overrides.invalid_type_error != null) {
    let issue =
      typeof overrides.invalid_type_error === "string"
        ? ctx.issue(invalid_type.CODE, overrides.invalid_type_error)
        : overrides.invalid_type_error(ctx, input);
    if (typeof issue === "string") {
      issue = ctx.issue(invalid_type.CODE, issue);
    }
    return issue;
  }
  if (code === required.CODE && overrides.required_error != null) {
    let issue =
      typeof overrides.required_error === "string"
        ? ctx.issue(required.CODE, overrides.required_error)
        : overrides.required_error(ctx, input);
    if (typeof issue === "string") {
      issue = ctx.issue(required.CODE, issue);
    }
    return issue;
  }
};

export abstract class BaseType {
  private overrides = {} as CoreIssueOverrides;

  protected isOptional = false;
  protected isNullable = false;

  optional(): this & IsOptional {
    const clone = this.clone();
    clone.isOptional = true;
    return clone as any;
  }

  nullable(): this & IsNullable {
    const clone = this.clone();
    clone.isNullable = true;
    return clone as any;
  }

  issues(overrides: CoreIssueOverrides) {
    const clone = this.clone();
    clone.overrides = overrides;
    return clone;
  }
  abstract parse(input: unknown, options?: ParseOptions): unknown;
  abstract parseAsync(input: unknown, options?: ParseOptions): Promise<unknown>;
  abstract safeParse(
    input: unknown,
    options?: ParseOptions,
  ): ParseResult<unknown>;
  abstract safeParseAsync(
    input: unknown,
    options?: ParseOptions,
  ): Promise<ParseResult<unknown>>;

  protected clone() {
    return Object.create(
      Object.getPrototypeOf(this),
      Object.getOwnPropertyDescriptors(this),
    ) as this;
  }

  private parseInput<T>(ctx: ParseContext, input: unknown): T {
    const context = internalContext(ctx);

    let value: unknown;
    let issue: Issue | undefined;

    const actualType = this.getShadowedType(ctx, input) ?? this;

    if (input == null) {
      if (!this.isOptional && input === undefined) {
        issue = ctx.issue(required(input, ctx.path));
      }
      if (!this.isNullable && input === null) {
        issue = ctx.issue(required(input, ctx.path));
      }
    } else {
      const res = actualType.check(ctx, input);

      if (res === true) {
        value = input;
      } else {
        value = actualType.coerce(ctx, input);
        if (value == null) {
          issue = res;
        } else {
          context.removeIssues([res]);
        }
      }
    }

    context.setInput(input, issue == null, actualType);

    let isDefaultValue = false;
    if (value != null) {
      value = actualType.clean(ctx, value);
    } else {
      isDefaultValue = true;
      value = actualType.defaultValue;
    }

    // clone objects and arrays so that derived classes don't need to
    if (isObject(value)) {
      value = { ...value };
    } else if (Array.isArray(value)) {
      value = [...value];
    }

    const issueOverride = tryGetCoreIssueOverride(
      ctx,
      input,
      issue?.code ?? "",
      this.overrides, // overrides come from this, not actualType
    );

    if (issueOverride) {
      if (issue) {
        context.removeIssues([issue]);
      }
      issue = issueOverride;
    }

    if (issue) context.addIssues([issue]);

    // nested keys for objects & arrays
    if (!isDefaultValue) {
      const parent = value as any;
      for (const { key, type } of actualType.getChildKeys(parent)) {
        const child = context.withChildPath(key, () =>
          type.parseInput(ctx, parent[key]),
        );
        parent[key] = child;
      }
    }

    return value as T;
  }

  protected get isLiteral() {
    return false;
  }

  protected get literalValue(): string | number | boolean {
    throw new Error("Not a literal type");
  }

  protected getLiteralKeys(): LiteralKey[] {
    return [];
  }

  protected getShadowedType(ctx: ParseContext, input: unknown) {
    return undefined as BaseType | undefined;
  }

  protected abstract get defaultValue(): unknown;

  protected abstract getChildKeys(value: unknown): ChildKey[];

  protected abstract get hasAsyncValidators(): boolean;

  protected abstract check(ctx: ParseContext, input: unknown): true | Issue;
  protected abstract coerce(
    ctx: ParseContext,
    input: unknown,
  ): unknown | undefined;
  protected abstract clean(ctx: ParseContext, value: unknown): unknown;

  protected abstract validate(ctx: ParseContext, value: unknown): void;
  protected abstract validateAsync(
    ctx: ParseContext,
    value: unknown,
  ): Promise<void>;

  protected abstract getExtensionParams(name: string): any[] | undefined;
}

export abstract class Type<T> extends BaseType {
  private validators = [] as {
    validator: Validator<T>;
    // extension
    name?: string;
    params?: any[];
    override?: Exclude<ValidationResultOverride<T>, string>;
  }[];

  private asyncValidators = [] as {
    validator: AsyncValidator<T>;
    // extension
    name?: string;
    params?: any[];
    override?: Exclude<ValidationResultOverride<T>, string>;
  }[];

  override parse(input: unknown, options?: ParseOptions) {
    const result = this.safeParse(input, options);
    if (!result.success) throw new ParseError(result.input, result.issues);
    return result.data;
  }

  override async parseAsync(input: unknown, options?: ParseOptions) {
    const result = await this.safeParseAsync(input, options);
    if (!result.success) throw new ParseError(result.input, result.issues);
    return result.data;
  }

  override safeParse(input: unknown, options?: ParseOptions) {
    if (this.hasAsyncValidators) {
      throw new Error(
        "Asynchronous validators present, call parseAsync or safeParseAsync",
      );
    }
    const ctx = new ParseContextInternal(options ?? {});
    return this.getParseResult(ctx, input) as ParseResult<T>;
  }

  override async safeParseAsync(input: unknown, options?: ParseOptions) {
    const ctx = new ParseContextInternal(options ?? {});
    return await this.getParseResult(ctx, input);
  }

  protected override get hasAsyncValidators() {
    return this.asyncValidators.length > 0;
  }

  refine(validator: Validator<T>) {
    const clone = this.clone();
    clone.validators.push({ validator });
    return clone;
  }

  refineAsync(validator: AsyncValidator<T>) {
    const clone = this.clone();
    clone.asyncValidators.push({ validator });
    return clone;
  }

  private getParseResult(ctx: ParseContext, input: unknown) {
    const context = internalContext(ctx);
    const value = internalType(this).parseInput<T>(ctx, input);

    const makeResult = (): ParseResult<T> => {
      const issues = context.getIssues();
      if (!issues.length) {
        return {
          success: true,
          data: value,
          input: undefined,
          issues: undefined,
        };
      }
      return {
        success: false,
        data: undefined,
        issues,
        input: context.getParsedInput(value),
      };
    };

    this.validate(ctx, value);

    if (this.hasAsyncValidators) {
      return (async () => {
        await this.validateAsync(ctx, value);
        return makeResult();
      })();
    }

    return makeResult();
  }

  protected override clone() {
    const copy = super.clone();
    copy.validators = [...this.validators];
    copy.asyncValidators = [...this.asyncValidators];
    return copy;
  }

  protected abstract override check(
    ctx: ParseContext,
    input: unknown,
  ): true | Issue;

  protected override coerce(ctx: ParseContext, input: unknown): T | undefined {
    return undefined;
  }

  protected override clean(ctx: ParseContext, value: T) {
    return value;
  }

  protected abstract get defaultValue(): T;

  protected getChildKeys(value: T) {
    return [] as { key: string | number; type: BaseType }[];
  }

  protected override validate(ctx: ParseContext, value: T): void {
    const context = internalContext(ctx);

    if (context.pathHasErrors) {
      return;
    }

    for (const { key, type } of this.getChildKeys(value)) {
      context.withChildPath(key, () => {
        internalType(type).validate(ctx, (value as any)[key]);
      });
    }

    context.withProxy(value, (value, resetPath) => {
      const path = ctx.path;
      for (const { validator, override } of this.validators) {
        resetPath();

        try {
          const trackingCtx = new IssueTrackingContext(ctx);
          const result = validator(trackingCtx, value);
          const issues = getIssues(result);

          if (override) {
            const newIssues = [...issues, ...trackingCtx.newIssues];
            this.overrideIssues(context, value, newIssues, override, path);
          } else {
            context.addIssues(issues);
          }
        } catch (e) {
          if (e instanceof ContextKeyError) {
            throw e;
          }
          ctx.issue(exception(e as Error, ctx.path));
        }
      }
    });
  }

  protected override async validateAsync(ctx: ParseContext, value: T) {
    const context = internalContext(ctx);

    if (context.pathHasErrors) {
      return;
    }

    for (const { key, type } of this.getChildKeys(value)) {
      await context.withChildPathAsync(key, () =>
        internalType(type).validateAsync(ctx, (value as any)[key]),
      );
    }

    await context.withProxyAsync(value, async (value, resetPath) => {
      const path = ctx.path;
      for (const { validator, override } of this.asyncValidators) {
        resetPath();

        try {
          const trackingCtx = new IssueTrackingContext(ctx);
          const result = await validator(trackingCtx, value);
          const issues = getIssues(result);

          if (override) {
            const newIssues = [...issues, ...trackingCtx.newIssues];
            this.overrideIssues(context, value, newIssues, override, path);
          } else {
            context.addIssues(issues);
          }
        } catch (e) {
          if (e instanceof ContextKeyError) {
            throw e;
          }
          ctx.issue(exception(e as Error, ctx.path));
        }
      }
    });
  }

  private overrideIssues(
    ctx: ParseContextInternal,
    value: T,
    issues: Issue[],
    override: Exclude<ValidationResultOverride<T>, string>,
    overridePath: Path,
  ) {
    ctx.removeIssues(issues);
    let issue = override(ctx, value);
    if (typeof issue === "string") {
      issue = ctx.issue({ code: "custom", message: issue, path: overridePath });
    }
    ctx.addIssues([issue]);
  }

  protected extend(
    name: keyof this,
    params: any[],
    override: { message: ValidationResultOverride<T> } | undefined,
    validator: Validator<T>,
  ) {
    return this.addExtension(false, name, params, override?.message, validator);
  }

  protected extendAsync(
    name: keyof this,
    params: any[],
    override: { message: ValidationResultOverride<T> } | undefined,
    validator: AsyncValidator<T>,
  ) {
    return this.addExtension(true, name, params, override?.message, validator);
  }

  private addExtension(
    isAsync: boolean,
    name: keyof this,
    params: any[],
    override: ValidationResultOverride<T> | undefined,
    validator: Validator<T> | AsyncValidator<T>,
  ) {
    const clone = this.clone();

    const list = isAsync ? clone.asyncValidators : clone.validators;

    let index = list.findIndex((val) => val.name === name);
    if (index < 0) {
      index = list.length;
    }

    list[index] = {
      name: name as string,
      params,
      validator: validator as any,
      override: typeof override === "string" ? () => override : override,
    };

    return clone;
  }

  protected override getExtensionParams(name: string) {
    return (
      this.validators.find((val) => val.name === name)?.params ??
      this.asyncValidators.find((val) => val.name === name)?.params
    );
  }
}

/**
 * Gets the type for a given path, enables partial validation
 * ```ts
 * const s = getPathType(Customer, ["addresses", 0, "street"] as const)
 * s.safeParse(e.target.value) // validate on blur!
 * ```
 */
export function getPathType<T extends BaseType, P extends Path>(
  containerType: T,
  path: P,
): PathType<T, P> {
  let type = internalType(containerType);
  for (const key of path) {
    const value = type.defaultValue;
    if (Array.isArray(value)) {
      value[key as number] = undefined;
    }
    const childKeys = type.getChildKeys(value);
    const child = childKeys.find((c) => c.key === key);
    if (child) {
      type = internalType(child.type);
    } else {
      type = undefined as any;
      break;
    }
  }
  return type as any;
}
