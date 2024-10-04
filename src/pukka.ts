import type { BaseType, CoreIssueOverrides } from "./base";
import { registerType } from "./extend";

import {
  ArrayType,
  BooleanLiteralType,
  BooleanType,
  EnumType,
  FileType,
  NumberLiteralType,
  NumberType,
  ObjectType,
  RecordType,
  StringLiteralType,
  StringType,
  UnionType,
} from "./types";

type StringTypeConfig = ConstructorParameters<typeof StringType>[0];
type NumberTypeConfig = ConstructorParameters<typeof NumberType>[0];
type BooleanTypeConfig = ConstructorParameters<typeof BooleanType>[0];

type LiteralTypeParam = string | number | boolean;
type RecordTypeParam = ConstructorParameters<typeof RecordType>[0];
type ObjectTypeParam = ConstructorParameters<typeof ObjectType>[0];
type ArrayItemType = ConstructorParameters<typeof ArrayType>[0];
type ArrayTypeConfig = ConstructorParameters<typeof ArrayType>[1];

function literal<S extends string>(
  value: S,
  overrrides?: CoreIssueOverrides,
): StringLiteralType<S>;
function literal<N extends number>(
  value: N,
  overrrides?: CoreIssueOverrides,
): NumberLiteralType<N>;
function literal<B extends boolean>(
  value: B,
  overrrides?: CoreIssueOverrides,
): BooleanLiteralType<B>;
function literal(value: LiteralTypeParam, overrides: CoreIssueOverrides = {}) {
  if (typeof value === "string") {
    return new StringLiteralType(value).issues(overrides);
  }
  if (typeof value === "number") {
    return new NumberLiteralType(value).issues(overrides);
  }
  return new BooleanLiteralType(value).issues(overrides);
}

export const pukka = {
  number: registerType(NumberType),
  string: registerType(StringType),
  boolean: registerType(BooleanType),
  file: registerType(FileType),

  enum<S extends string>(values: S[], overrides: CoreIssueOverrides = {}) {
    return new EnumType(values).issues(overrides);
  },

  literal,

  record<V extends RecordTypeParam>(
    valueType: V,
    overrides: CoreIssueOverrides = {},
  ) {
    return new RecordType(valueType).issues(overrides);
  },

  object<R extends ObjectTypeParam>(
    props: R,
    overrides: CoreIssueOverrides = {},
  ) {
    return new ObjectType(props).issues(overrides);
  },

  array<I extends ArrayItemType>(
    itemType: I,
    config: CoreIssueOverrides & ArrayTypeConfig = {},
  ) {
    return new ArrayType(itemType, config).issues(config);
  },

  union<U extends BaseType[]>(types: U, overrides: CoreIssueOverrides = {}) {
    return new UnionType(types).issues(overrides);
  },
};
