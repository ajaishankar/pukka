import type { BaseType, CoreIssueOverrides, MessageOverride } from "./base";
import { internalType } from "./internal";

type TypeConstructor<T extends BaseType = BaseType> = new (...args: any[]) => T;

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

export type Extended<R> = <F extends (...args: any[]) => any>(
  fn: F,
) => (...args: Parameters<F>) => R;

/**
 * Get an extension's parameters for codegen tools say pukka-openapi
 * ```ts
 * const s = z.string().minLength(2)
 * expect(getExtensionParams(s, StringExtensions, "minLength")).toEqual([2])
 * ```
 */
export function getExtensionParams<
  X extends TypeConstructor,
  M extends Exclude<
    keyof InstanceType<X>,
    keyof BaseType | "refine" | "refineAsync"
  >,
>(type: BaseType, ctor: X, name: M) {
  type O = MessageOverride;
  type T = InstanceType<X>;
  type P = T[M] extends (...args: any[]) => any ? Parameters<T[M]> : never;
  type R = Required<P> extends [...infer H, infer L extends O] ? H : P;
  return internalType(type).getExtensionParams(name as string) as R | undefined;
}

/**
 * Apply extensions to a type, this updates the type's prototype
 * ```ts
 * const extendedString = applyExtensions(StringType, StringExtensions);
 * const x = {
 *   ...z,
 *   string: extendedString(z.string),
 * };
 * const s = x.string().minLength(2) // minLength from StringExtensions
 * ```
 */
export function applyExtensions<B extends TypeConstructor, X1 extends B>(
  Base: B,
  Ext1: X1,
): Extended<InstanceType<B> & InstanceType<X1>>;
export function applyExtensions<
  B extends TypeConstructor,
  X1 extends B,
  X2 extends B,
>(
  Base: B,
  Ext1: X1,
  Ext2: X2,
): Extended<InstanceType<B> & InstanceType<X1> & InstanceType<X2>>;
export function applyExtensions<
  B extends TypeConstructor,
  X1 extends B,
  X2 extends B,
  X3 extends B,
>(
  Base: B,
  Ext1: X1,
  Ext2: X2,
  Ext3: X3,
): Extended<
  InstanceType<B> & InstanceType<X1> & InstanceType<X2> & InstanceType<X3>
>;
export function applyExtensions<B extends TypeConstructor>(
  Base: B,
  ...extensions: any[]
) {
  for (const ext of extensions) {
    const ctorProps = Object.getOwnPropertyDescriptors(Base.prototype);
    for (const name of Object.getOwnPropertyNames(ext.prototype)) {
      if (!ctorProps[name]) {
        Object.defineProperty(
          Base.prototype,
          name,
          Object.getOwnPropertyDescriptor(ext.prototype, name)!,
        );
      }
    }
  }

  return (fn: any) => fn as any;
}
