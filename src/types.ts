import { type BaseType, type Infer, type LiteralKey, Type } from "./base";
import type { ParseContext, ParseOptions } from "./context";
import { internalContext, internalType } from "./internal";
import { CORE_ISSUES, type Issue } from "./issue";
import { isObject } from "./util";

const { invalid_type, required } = CORE_ISSUES;

type StringTypeConfig = {
  /** Trim strings (default true) */
  trim?: boolean;
  /** Coerce input to string (default false) */
  coerce?: boolean;
  /**
   * Allow empty strings (default true)
   *
   * If false, empty strings will raise a required issue
   */
  empty?: boolean;
};

export class StringType extends Type<string> {
  private trim?: boolean;
  private empty?: boolean;
  private _coerce?: boolean;

  constructor(config?: StringTypeConfig) {
    super();
    this.trim = config?.trim;
    this.empty = config?.empty;
    this._coerce = config?.coerce;
  }

  protected override get defaultValue() {
    return "";
  }

  protected override check(ctx: ParseContext, input: unknown) {
    if (typeof input !== "string") {
      return ctx.issue(invalid_type("string", input, ctx.path));
    }

    const allowEmpty = this.empty ?? ctx.options.string?.empty ?? true;

    const value = this.trimValue(ctx.options, input);
    if (!allowEmpty && value.length === 0) {
      return ctx.issue(required(input, ctx.path));
    }

    return true;
  }

  protected override coerce(ctx: ParseContext, input: unknown) {
    const coerce = this._coerce ?? ctx.options.string?.coerce ?? false;
    if (coerce && input != null && typeof input !== "object") {
      return String(input);
    }
  }

  protected override clean(ctx: ParseContext, value: string) {
    return this.trimValue(ctx.options, value);
  }

  private trimValue(options: ParseOptions, value: string) {
    const trim = this.trim ?? options.string?.trim ?? true;
    return trim ? value.trim() : value;
  }
}

export class NumberType extends Type<number> {
  _coerce?: boolean;

  constructor(config?: { coerce?: boolean }) {
    super();
    this._coerce = config?.coerce;
  }

  protected override get defaultValue() {
    return 0;
  }

  protected override check(ctx: ParseContext, input: unknown) {
    return (
      typeof input === "number" ||
      ctx.issue(invalid_type("number", input, ctx.path))
    );
  }

  protected override coerce(ctx: ParseContext, input: unknown) {
    const coerce = this._coerce ?? ctx.options.number?.coerce ?? false;
    if (coerce) {
      const num = Number(input);
      return Number.isNaN(num) ? undefined : num;
    }
  }
}

export class BooleanType extends Type<boolean> {
  _coerce?: boolean;

  constructor(config?: { coerce?: boolean }) {
    super();
    this._coerce = config?.coerce;
  }

  protected override get defaultValue() {
    return false;
  }

  protected override check(ctx: ParseContext, input: unknown) {
    return (
      typeof input === "boolean" ||
      ctx.issue(invalid_type("boolean", input, ctx.path))
    );
  }

  protected override coerce(ctx: ParseContext, input: unknown) {
    const coerce = this._coerce ?? ctx.options.boolean?.coerce ?? false;
    if (coerce && input != null) {
      return Boolean(input);
    }
  }
}

export class EnumType<S extends string> extends Type<S> {
  constructor(readonly values: S[]) {
    super();
  }

  protected override get defaultValue() {
    return "" as S;
  }

  protected override check(ctx: ParseContext, input: unknown) {
    return (
      this.values.includes(input as any) ||
      ctx.issue(invalid_type(`One of [${this.values}]`, input, ctx.path))
    );
  }
}

abstract class LiteralType<
  L extends string | number | boolean,
> extends Type<L> {
  constructor(readonly value: L) {
    super();
  }

  protected override get isLiteral() {
    return true;
  }

  protected override get literalValue() {
    return this.value;
  }

  protected override get defaultValue() {
    return this.value;
  }

  protected override check(ctx: ParseContext, input: unknown) {
    return (
      input === this.value ||
      ctx.issue(invalid_type(`${this.value}`, input, ctx.path))
    );
  }
}

export class StringLiteralType<S extends string> extends LiteralType<S> {}
export class NumberLiteralType<N extends number> extends LiteralType<N> {}
export class BooleanLiteralType<B extends boolean> extends LiteralType<B> {}

export class FileType extends Type<File> {
  protected override get defaultValue() {
    return new File([], "");
  }

  protected override check(ctx: ParseContext, input: unknown) {
    return (
      input instanceof File || ctx.issue(invalid_type("file", input, ctx.path))
    );
  }
}

export class RecordType<V extends BaseType> extends Type<
  Infer<Record<string, V>>
> {
  public constructor(readonly valueType: V) {
    super();
  }

  protected override get defaultValue() {
    return {} as Infer<Record<string, V>>;
  }

  protected override check(ctx: ParseContext, input: unknown) {
    return (
      isObject(input) || ctx.issue(invalid_type("record", input, ctx.path))
    );
  }

  protected override getChildKeys(value: Infer<Record<string, V>>) {
    return Object.entries(value).map(([key]) => ({
      key,
      type: this.valueType,
    }));
  }

  protected override get hasAsyncValidators() {
    return (
      super.hasAsyncValidators ||
      internalType(this.valueType).hasAsyncValidators
    );
  }
}

export class ObjectType<R extends Record<string, BaseType>> extends Type<
  Infer<R>
> {
  private childKeys: { key: string | number; type: BaseType }[];
  private literalKeys: LiteralKey[];
  private _defaultValue: Infer<R>;

  constructor(readonly properties: R) {
    super();

    this.childKeys = Object.entries(this.properties).map(([key, type]) => ({
      key,
      type,
    }));

    this.literalKeys = Object.entries(this.properties)
      .filter(([key, type]) => internalType(type).isLiteral)
      .map(([key, type]) => ({
        key,
        type,
        value: internalType(type).literalValue,
      }));

    this._defaultValue = Object.fromEntries(
      this.childKeys.map(({ key, type }) => [
        key,
        internalType(type).defaultValue,
      ]),
    ) as Infer<R>;
  }

  protected override get defaultValue() {
    return this._defaultValue;
  }

  protected override check(ctx: ParseContext, input: unknown) {
    return (
      isObject(input) || ctx.issue(invalid_type("object", input, ctx.path))
    );
  }

  protected override clean(ctx: ParseContext, value: Infer<R>) {
    const extraKeys = Object.keys(value).filter((key) => !this.properties[key]);

    for (const key of extraKeys) {
      delete value[key];
    }

    return value;
  }

  protected override getChildKeys() {
    return this.childKeys;
  }

  protected override getLiteralKeys() {
    return this.literalKeys;
  }

  protected override get hasAsyncValidators() {
    return (
      super.hasAsyncValidators ||
      Object.values(this.properties).some(
        (type) => internalType(type).hasAsyncValidators,
      )
    );
  }
}

export class ArrayType<I extends BaseType> extends Type<Infer<I[]>> {
  private _coerce: boolean | undefined;

  constructor(
    readonly itemType: I,
    config?: { coerce?: boolean },
  ) {
    super();
    this._coerce = config?.coerce;
  }

  protected override check(ctx: ParseContext, input: unknown) {
    return (
      Array.isArray(input) || ctx.issue(invalid_type("array", input, ctx.path))
    );
  }

  protected override coerce(ctx: ParseContext, input: unknown) {
    if (input != null && this._coerce) {
      return [input] as Infer<I[]>;
    }
  }

  protected override get defaultValue() {
    return [] as Infer<I[]>;
  }

  protected override getChildKeys(array: Infer<I>[]) {
    const list = [] as { key: number; type: BaseType }[];
    // handle sparse arrays
    for (let key = 0; key < array.length; ++key) {
      if (key in array) {
        list.push({ key, type: this.itemType });
      }
    }
    return list;
  }

  protected override get hasAsyncValidators() {
    return (
      super.hasAsyncValidators || internalType(this.itemType).hasAsyncValidators
    );
  }
}

export class UnionType<U extends BaseType[]> extends Type<Infer<U>[number]> {
  private discriminatedTypes: { type: BaseType; keys: LiteralKey[] }[];

  constructor(readonly types: U) {
    super();
    if (types.length === 0) {
      throw new Error("UnionType options cannot be empty");
    }
    this.discriminatedTypes = this.types
      .map((type) => ({
        type,
        keys: internalType(type).getLiteralKeys(),
      }))
      .filter(({ keys }) => keys.length > 0);
  }

  /* v8 ignore start */
  protected override check(ctx: ParseContext, input: unknown): Issue {
    throw new Error("Check will be invoked on shadowed type");
  }
  /* v8 ignore stop */

  protected override get defaultValue() {
    return internalType(this.types[0]).defaultValue as Infer<U>[number];
  }

  protected override getShadowedType(ctx: ParseContext, input: unknown) {
    const context = internalContext(ctx);

    const match = this.getDiscriminatedMatch(input);

    const typesToCheck = match
      ? [match]
      : this.types.length === this.discriminatedTypes.length // if all types are discriminated
        ? [this.types[0]] // default to first since we didn't find a match
        : this.types; // else check all types

    for (const type of typesToCheck) {
      const clone = context.clone();
      internalType(type).parseInput(clone, input);
      if (clone.issueCount === context.issueCount) {
        return type;
      }
    }

    return typesToCheck[0];
  }

  private getDiscriminatedMatch(input: unknown) {
    if (!isObject(input)) {
      return;
    }

    const match = this.discriminatedTypes.find(({ keys }) => {
      return (
        keys.length > 0 &&
        keys.every(({ key, value }) => (input as any)[key] === value)
      );
    });

    return match?.type;
  }

  protected override get hasAsyncValidators() {
    return (
      super.hasAsyncValidators ||
      this.types.some((type) => internalType(type).hasAsyncValidators)
    );
  }
}
