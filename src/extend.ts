import type {
  AsyncValidator,
  BaseType,
  CoreIssueOverrides,
  Infer,
  MessageOverride,
  Validator,
} from "./base";
import { internalType } from "./internal";

type TypeConstructor<T extends BaseType = BaseType> = new (...args: any[]) => T;

type AbstractTypeConstructor<T extends BaseType = BaseType> = abstract new (
  ...args: any[]
) => T;

type SyncExtensions<T> = {
  [name: string]: (...args: any[]) => Validator<T>;
};

type AsyncExtensions<T> = {
  [name: string]: (...args: any[]) => AsyncValidator<T>;
};

type Extensions<T> = {
  [name: string]: ((...args: any[]) => Validator<T> | AsyncValidator<T>) & {
    async: boolean;
  };
};

export type Extended<T extends BaseType, X extends Extensions<Infer<T>>> = T & {
  [K in Exclude<keyof X, keyof T>]: (
    ...args: [...Parameters<X[K]>, override?: MessageOverride<Infer<T>>]
  ) => Extended<T, X>;
};

/**
 * Helper to register a type with a constructor taking a single object parameter
 *
 * Returns a function that accepts the parameter & CoreIssueOverrides
 */
export function registerType<T extends BaseType, C extends new (arg: any) => T>(
  ctor: C,
) {
  type P = ConstructorParameters<C>;
  type I = InstanceType<C>;
  return (param: (P extends [] ? {} : P[0]) & CoreIssueOverrides = {}) =>
    (new ctor(param) as I).issues(param);
}

function extensions<
  T extends BaseType,
  C extends AbstractTypeConstructor<T>,
  X extends SyncExtensions<Infer<InstanceType<C>>>,
>(ctor: C, extensions: X) {
  for (const x of Object.values(extensions)) {
    (x as any).async = false;
  }
  return extensions as {
    [K in keyof X]: X[K] & { async: false };
  };
}

function asyncExtensions<
  T extends BaseType,
  C extends AbstractTypeConstructor<T>,
  X extends AsyncExtensions<Infer<InstanceType<C>>>,
>(ctor: C, extensions: X) {
  for (const x of Object.values(extensions)) {
    (x as any).async = true;
  }
  return extensions as {
    [K in keyof X]: X[K] & { async: true };
  };
}

function applyExtensions<
  T extends BaseType,
  C extends TypeConstructor<T>,
  X extends Extensions<Infer<InstanceType<C>>>,
>(ctor: C, extensions: X) {
  const descriptors = new Set<string>();
  let proto = ctor.prototype;
  while (proto) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      descriptors.add(name);
    }
    proto = Object.getPrototypeOf(proto);
  }

  for (const [name, fn] of Object.entries(extensions)) {
    if (descriptors.has(name)) {
      continue;
    }
    Object.defineProperty(ctor.prototype, name, {
      value: function (this: any, ...args: any[]) {
        const lastArg = args[args.length - 1];
        const hasOverride = lastArg?.message != null;
        const override = hasOverride ? lastArg : undefined;
        const params = hasOverride ? args.slice(0, -1) : args;
        const validator = fn(...params);
        if (fn.async) {
          return this.extendAsync(name, params, override, validator);
        }
        return this.extend(name, params, override, validator);
      },
    });
  }

  type I = InstanceType<C>;
  type Ext = Extended<I, X>;

  return <F extends (...args: any[]) => I>(fn: F) =>
    fn as (...args: Parameters<F>) => I & Ext;
}

function getExtensionParams<
  T extends BaseType,
  X extends Extensions<Infer<T>>,
  M extends keyof X,
>(type: T, ext: X, name: M) {
  type P = Parameters<X[M]>;
  return internalType(type).getExtensionParams(name as string) as P | undefined;
}

export const Extensions = {
  for: extensions,
  forAsync: asyncExtensions,
  /**
   * Apply extensions to a type, this updates the type's prototype
   * ```ts
   * const extendedString = Extensions.apply(StringType, StringExtensions);
   * const x = {
   *   ...z,
   *   string: extendedString(z.string),
   * };
   * const s = x.string().min(2) // min from StringExtensions
   * ```
   */
  apply: applyExtensions,
  /**
   * Get an extension's parameters for codegen tools say pukka-openapi
   * ```ts
   * const s = z.string().min(2)
   * expect(getExtensionParams(s, StringExtensions, "min")).toEqual([2])
   * ```
   */
  getParams: getExtensionParams,
};
