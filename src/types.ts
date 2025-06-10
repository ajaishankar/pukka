type Primitive = string | number | boolean | bigint | File;

export type PrimitiveType = "string" | "boolean" | "number" | "bigint" | "file";

type PrimitiveMap = {
  string: string;
  boolean: boolean;
  number: number;
  bigint: bigint;
  file: File;
};

export type PropertyType =
  | PrimitiveType
  | { [key: string]: PropertyType }
  | [PrimitiveType | { [key: string]: PropertyType }];

export type Property = {
  key: string | number;
  alias?: string;
  optional?: boolean;
  type:
    | PrimitiveType
    | { [key: string]: Property }
    | [PrimitiveType | { [key: string]: Property }];
};

export type Schema = Record<string, PropertyType>;

type Simplify<T> = { [K in keyof T]: T[K] } & {};

// return key after removing ":" and "?"
type Key<K extends string> = K extends `${infer P}${":" | "?"}${string}`
  ? P
  : K;

// keys that don't have "?"" at end
type RequiredKeys<K extends string> = K extends `${string}?` ? never : Key<K>;

// keys that have a "?" at end
type OptionalKeys<K extends string> = K extends `${infer P}?` ? Key<P> : never;

type InferValue<V> = V extends PrimitiveType
  ? PrimitiveMap[V]
  : V extends [infer E]
    ? InferValue<E>[]
    : Infer<V>;

export type Infer<T> = Simplify<
  {
    [K in keyof T as RequiredKeys<K & string>]: InferValue<T[K]>;
  } & {
    [K in keyof T as OptionalKeys<K & string>]: InferValue<T[K]> | undefined;
  }
>;

type DeepRequired<T> = T extends Primitive
  ? T
  : T extends any[]
    ? DeepRequired<T[number]>[]
    : { [K in keyof T]-?: DeepRequired<T[K]> };

type DeepPartial<T> = T extends Primitive
  ? T | undefined
  : T extends any[]
    ? DeepPartial<T[number]>[] | undefined
    : { [K in keyof T]-?: DeepPartial<T[K]> } | undefined;

type PushIssue<P extends string> = {
  push(error: string | ((key: P) => string)): void;
};

export type Issues<T, P extends string = ""> = PushIssue<P> &
  (T extends Primitive
    ? {}
    : T extends any[]
      ? { [K: number]: Issues<T[number], P> }
      : {
          [K in keyof T]-?: Issues<
            T[K],
            `${P extends "" ? "" : `${P}.`}${K & string}`
          >;
        });

export type Errors = Record<
  string,
  {
    value: string;
    errors: string[];
  }
>;

export type ValidationResult<Data extends Record<string, unknown>> =
  | {
      success: true;
      data: Data;
      errors: Errors;
    }
  | {
      success: false;
      data: DeepPartial<Data> & {};
      errors: Errors;
    };

export type FormHelper<T> = T extends Primitive
  ? {
      value: string;
      errors: string[];
      path: string;
    }
  : T extends any[]
    ? { [K: number]: FormHelper<T[number]> } & {
        length: number;
        [Symbol.iterator](): Iterator<FormHelper<T[number]>>;
        errors: string[];
        path: string;
      }
    : { [K in keyof T]-?: FormHelper<T[K]> } & {
        errors: string[];
        path: string;
      };

export type Context = Record<string, unknown>;

type Keys<Schema> = Schema extends object
  ? {
      [K in keyof Schema]-?: K extends string
        ? Schema[K] extends [infer U]
          ? U extends object
            ? `${Key<K>}.${Keys<U>}` | Key<K>
            : never
          : Schema[K] extends object
            ? `${Key<K>}.${Keys<Schema[K]>}` | Key<K>
            : Key<K>
        : never;
    }[keyof Schema]
  : never;

type SchemaKeys<S extends Schema> = Keys<S> | "";

export type BasicError =
  | {
      code: "exception";
      error: Error;
    }
  | {
      code: "required";
      received: string;
    }
  | {
      code: "type";
      expected: string;
      received: string;
    }
  | {
      code: "array";
      limit: number;
      length: number;
    };

export type ErrorMessageOverride<S extends Schema> = <
  K extends {} & SchemaKeys<S>,
>(
  key: K,
  error: BasicError,
) => string | undefined;

export type ValidatorOptions<S extends Schema> = {
  arrayLimit?: number;
  stringHandling?: {
    trim?: boolean;
    allowEmpty?: boolean;
  };
  errorMessage?: ErrorMessageOverride<S>;
};

export type Validator<S extends Schema> = (
  input: unknown,
  options?: ValidatorOptions<S>,
) => ValidationResult<Infer<S>>;

export type ValidateWithContext<S extends Schema, C extends Context> = (
  input: unknown,
  context: C & ValidatorOptions<S>,
) => ValidationResult<Infer<S>>;

export type SafeData<S extends Schema> = DeepRequired<Infer<S>>;

export type ValidatorCallback<S extends Schema, C extends Context> = (
  data: SafeData<S>,
  issues: Issues<Infer<S>>,
  ctx: C,
) => void;

export type ContextMarker<C extends Context> = { _: C };
