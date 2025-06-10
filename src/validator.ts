import { dset } from "dset";
import {
  addError,
  createIssues,
  getKey,
  isArray,
  isObject,
  stringify,
} from "./helper";

import type {
  BasicError,
  Context,
  ContextMarker,
  ErrorMessageOverride,
  Errors,
  Infer,
  PrimitiveType,
  Property,
  PropertyType,
  SafeData,
  Schema,
  ValidateWithContext,
  ValidationResult,
  Validator,
  ValidatorCallback,
  ValidatorOptions,
} from "./types";

const TRUE = ["true", "1", 1];
const FALSE = ["false", "0", 0];
const DEFAULT_ARRAY_LIMIT = 50;

/**
 * Define a type-safe schema for validation
 *
 * @example
 * ```typescript
 * const schema = object({
 *   name: "string",
 *   age: "number",
 *   "email?": "string" // optional field
 *   "username:un": "string", // field with alias
 *   hobbies: ["string"], // array
 *   address: { // nested object
 *     street: "string",
 *     city: "string",
 *     state: "string"
 *   },
 * })
 * ```
 */
export const object = <S extends Schema>(schema: S): S => schema;

/**
 * Runtime context to be used during validation
 * @example
 * ```typescript
 * // define runtime context
 * type MyContext = {
 *   states: {
 *     code: string
 *     cities: string[]
 *   }[]
 * }
 *
 * // create validator with context
 * const validate = validator.for(
 *   schema,
 *   usingContext<MyContext>(),
 *   (data, issues, ctx) => {
 *     const state = ctx.states.find(s => s.code === data.state)
 *     if (!state?.cities.includes(data.city)) {
 *       issues.city.push('Invalid city')
 *     }
 *   }
 * )
 */
export const usingContext = <C extends Context>(): ContextMarker<C> => ({
  _: undefined as unknown as C,
});

export const validator = {
  /**
   * Returns a validator for the given schema
   *
   * @example
   * ```typescript
   * const schema = object({
   *   name: "string",
   *   age: "number",
   *   address: {
   *     city: "string",
   *     state: "string"
   *   }
   * })
   *
   * // validate
   *
   * const validate = validator.for(schema, (data, issues) => {
   *   if(data.age < 18) {
   *     issues.age.push('Age must be at least 18')
   *   }
   * }
   *
   * const { success, data, errors } = validate(input)
   *
   * // or validate with runtime context
   *
   * type MyContext = {
   *   states: {
   *     code: string
   *     cities: string[]
   *   }[]
   * }
   *
   * const validate = validator.for(
   *   schema,
   *   usingContext<MyContext>(), // provide context type
   *   (data, issues, ctx) => {
   *     const state = ctx.states.find(s => s.code === data.state)
   *     if (!state?.cities.includes(data.city)) {
   *       issues.city.push('Invalid city')
   *     }
   *   }
   * )
   *
   * const result = validate(input, {
   *   states: [{ code: 'CA', cities: ['San Francisco', 'Los Angeles'] }]
   * })
   *
   * // strongly typed keys for localization
   *
   * const validate = validator.for(schema, (data, issues) => {
   *  issues.address.street.push(key => i18n.t(key))) // key is 'address.street'
   * })
   *
   * // customize array limit and default messages
   *
   * validate(input, {
   *   arrayLimit: 20,
   *   errorMessage: (key, error) => {
   *     if (error.code === 'required') {
   *      return `${key} is required`
   *     }
   *     if (error.code === 'type') {
   *       return `Expected ${error.expected}, received ${error.received}`
   *     }
   *     if (error.code === 'array') {
   *       return `Array length ${error.length} is greater than limit ${error.limit}`
   *     }
   *     if (error.code === 'exception') {
   *       return `Exception: ${error.error.message}`
   *     }
   *     return `Unknown error`
   *   }
   * })
   * ```
   */
  for: createValidator,
};

function parseSchema(
  schema: Record<string, PropertyType>,
): Record<string, Property> {
  const entries = Object.entries(schema).map(([key, type]) => {
    const optional = key.endsWith("?");
    const [name, alias] = key.replace("?", "").split(":");
    const isArray = Array.isArray(type);
    const actualType = isArray ? type[0] : type;
    const isNestedType = isObject(actualType);
    const propertyType = isNestedType ? parseSchema(actualType) : actualType;
    const property: Property = {
      key: name,
      alias,
      type: isArray ? [propertyType] : propertyType,
      optional,
    };
    return [name, property] as [string, Property];
  });
  return Object.fromEntries(entries);
}

function coerce(input: unknown, type: PrimitiveType | "array" | "object") {
  if (type === "object") {
    return isObject(input) ? input : undefined;
  }

  // if expecting array, coerce single value to array
  if (type === "array") {
    return Array.isArray(input) ? input : [input];
  }

  // if expecting primitive coerce array with single element
  if (Array.isArray(input) && input.length === 1) {
    input = input[0];
  }

  if (type === "string") {
    return typeof input === "string" ? input : String(input);
  }

  if (type === "boolean") {
    return typeof input === "boolean"
      ? input
      : TRUE.includes(input as any)
        ? true
        : FALSE.includes(input as any)
          ? false
          : undefined;
  }

  if (type === "number") {
    if (typeof input === "number") return input;
    if (typeof input === "string" && !input.length) return undefined;
    const value = Number(input);
    return Number.isNaN(value) ? undefined : value;
  }

  if (type === "bigint") {
    if (typeof input === "bigint") return input;
    if (typeof input === "string" && !input.length) return undefined;
    try {
      return BigInt(input as any);
    } catch {
      return undefined;
    }
  }

  return input instanceof File ? input : undefined;
}

function defaultValue(property: Property) {
  const { type } = property;
  if (type === "string") return "";
  if (type === "boolean") return false;
  if (type === "number") return 0;
  if (type === "file") return new File([], "");
  if (type === "bigint") return 0n;
  if (isArray(type)) return [];
  return Object.fromEntries(
    Object.entries(type).map(([key, childProp]): any => {
      return [key, defaultValue(childProp)];
    }),
  );
}

const getDisplayName = (path: string) => {
  const arr = path.split(".");
  const name = arr[arr.length - 1];
  const first = name.substring(0, 1).toUpperCase();
  const rest = name
    .substring(1)
    .replace(/([a-z])([A-Z])/g, ([l, u]) => `${l} ${u}`);
  return `${first}${rest}`;
};

const getErrorMessage = (
  path: string,
  code: BasicError["code"],
  inputOrException: unknown,
  override?: ErrorMessageOverride<{}>,
  expected?: PrimitiveType | "object" | "array" | number,
) => {
  const key = getKey(path) as any;

  if (code === "required") {
    const name = getDisplayName(key);
    return (
      override?.(key, {
        code: "required",
        received: typeof inputOrException,
      }) ?? `${name} is required`
    );
  }

  if (code === "type") {
    const received = stringify(inputOrException) || typeof inputOrException;
    return (
      override?.(key, {
        code: "type",
        expected: String(expected),
        received,
      }) ?? `Expected '${expected}', received '${received}'`
    );
  }

  if (code === "array") {
    const limit = Number(expected);
    const length = (inputOrException as unknown[]).length;
    return (
      override?.(key, {
        code: "array",
        limit,
        length,
      }) ?? `Array length ${length} is greater than limit ${limit}`
    );
  }

  const error = inputOrException as Error;
  return (
    override?.(key, {
      code,
      error,
    }) ?? `Exception: ${error.message}`
  );
};

function validate(
  path: string,
  property: Property,
  source: any,
  target: any,
  safeTarget: any,
  options: ValidatorOptions<{}>,
  errors: Errors,
) {
  const isRoot = path === "";

  const { key, alias, type, optional } = property;

  const errorMessage = options.errorMessage;
  const arrayLimit = options.arrayLimit ?? DEFAULT_ARRAY_LIMIT;

  let input = isRoot ? source : source[alias ?? key];

  if (typeof input === "string" && options.string?.trim === true) {
    input = input.trim();
  }

  const isEmptyString = typeof input === "string" && !input.length;

  if (
    input == null ||
    (isEmptyString && options.string?.allowEmpty === false)
  ) {
    if (!optional) {
      addError(
        errors,
        path,
        getErrorMessage(path, "required", input, errorMessage),
        input,
      );
    }
    if (!isRoot) {
      // empty array for form proxy
      target[key] = isArray(type) ? [] : input;
      safeTarget[key] = defaultValue(property);
    }
    return;
  }

  const expected = isArray(type) ? "array" : isObject(type) ? "object" : type;

  const value = coerce(input, expected);

  if (value == null) {
    addError(
      errors,
      path,
      getErrorMessage(path, "type", input, errorMessage, expected),
      input,
    );
    if (!isRoot) {
      target[key] = value;
      safeTarget[key] = defaultValue(property);
    }
    return;
  }

  if (!isArray(type) && !isObject(type)) {
    target[key] = safeTarget[key] = value;
    return;
  }

  if (isArray(type)) {
    const sourceArr = value as unknown[];
    // we don't support root arrays, no need to check for root
    const targetArr = (target[key] = []);
    const safeTargetArr = (safeTarget[key] = []);

    if (sourceArr.length > arrayLimit) {
      addError(
        errors,
        path,
        getErrorMessage(path, "array", sourceArr, errorMessage, arrayLimit),
      );
      return;
    }

    const itemType = { key: 0, optional: false, type: type[0] };
    for (let i = 0; i < sourceArr.length; ++i) {
      itemType.key = i;
      const itemPath = `${path}[${i}]`;
      validate(
        itemPath,
        itemType,
        sourceArr,
        targetArr,
        safeTargetArr,
        options,
        errors,
      );
    }
  } else {
    const sourceObj = value;
    const targetObj = isRoot ? target : (target[key] = {});
    const safeTargetObj = isRoot ? safeTarget : (safeTarget[key] = {});
    for (const [childKey, childProp] of Object.entries(type)) {
      const childPath = isRoot ? childKey : `${path}.${childKey}`;
      validate(
        childPath,
        childProp,
        sourceObj,
        targetObj,
        safeTargetObj,
        options,
        errors,
      );
    }
  }
}

const entries = (input: object | FormData | URLSearchParams) => {
  if (input instanceof FormData || input instanceof URLSearchParams) {
    const keys = Array.from(new Set(input.keys())); // unique keys
    return keys.map((key) => [key, input.getAll(key)] as const); // ?hobbies=reading&hobbies=coding
  }
  return Object.entries(input);
};

function normalizeInput(input: unknown) {
  if (
    !isObject(input) &&
    !(input instanceof FormData) &&
    !(input instanceof URLSearchParams)
  ) {
    return input;
  }
  const source = {};
  for (const [key, value] of entries(input)) {
    const path = key.replace(/\[\s*(\d+)\s*\]/g, ".$1"); // foo[0] => foo.0
    dset(source, path, value);
  }
  return source;
}

function isValidInput<S extends Schema>(
  input: unknown,
  errors: Errors,
  options: ValidatorOptions<S>,
) {
  if (isObject(input)) return true;
  const type = isArray(input)
    ? "array"
    : input === null
      ? "null"
      : (input?.constructor?.name ?? typeof input);
  const msg = getErrorMessage("", "type", type, options.errorMessage, "object");
  addError(errors, "", msg);
  return false;
}

function schemaValidator<S extends Schema, C extends Context>(
  schema: S,
  callback?: ValidatorCallback<S, C>,
) {
  const type = parseSchema(schema);

  return (
    input: unknown,
    ctx?: C & ValidatorOptions<S>,
  ): ValidationResult<Infer<S>> => {
    ctx ??= {} as C & ValidatorOptions<S>;

    input = normalizeInput(input);

    const data = {} as any;
    const safeData = {} as SafeData<S>;

    const root = { key: "", type };
    const errors = {} as Errors;

    try {
      if (isValidInput(input, errors, ctx)) {
        validate("", root, input, data, safeData, ctx, errors);
        if (callback) {
          const issues = createIssues<S>(data, errors);
          callback(safeData, issues, ctx);
        }
      }
    } catch (error: any) {
      const message = getErrorMessage("", "exception", error, ctx.errorMessage);
      addError(errors, "", message);
    }

    return {
      success: Object.keys(errors).length === 0,
      data,
      errors,
    };
  };
}

function createValidator<S extends Schema>(
  schema: S,
  callback?: ValidatorCallback<S, {}>,
): Validator<S>;
function createValidator<S extends Schema, C extends Context>(
  schema: S,
  context: ContextMarker<C>,
  callback: ValidatorCallback<S, C>,
): ValidateWithContext<S, C>;
function createValidator<S extends Schema, C extends Context>(
  schema: S,
  callbackOrContext?: ContextMarker<C> | ValidatorCallback<S, C>,
  callback?: ValidatorCallback<S, C>,
) {
  return schemaValidator(
    schema,
    typeof callbackOrContext === "function" ? callbackOrContext : callback,
  );
}
