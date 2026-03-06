import type {
  Errors,
  FormHelper,
  Infer,
  Issues,
  Schema,
  ValidationResult,
} from "./types";

export const isObject = (value: unknown): value is object => {
  return (
    value != null &&
    typeof value === "object" &&
    (value as any).constructor === Object
  );
};

export const isArray = (value: unknown): value is unknown[] => {
  return Array.isArray(value);
};

/** primitives to string */
export const stringify = (value: unknown) => {
  return value == null || typeof value === "object" ? "" : String(value);
};

export const addError = (
  errors: Errors,
  path: string,
  error: string,
  value?: unknown,
) => {
  if (errors[path] == null) {
    errors[path] = { value: stringify(value), errors: [error] };
  } else {
    errors[path].errors.push(error);
  }
};

export const form = {
  helper: <Data extends Record<string, unknown>>(
    result?: Omit<ValidationResult<Data>, "success">,
  ) => {
    return proxy(result?.data ?? {}, result?.errors) as FormHelper<Data>;
  },
};

export const createIssues = <S extends Schema>(
  input: unknown,
  errors: Errors,
) => proxy(input, errors) as unknown as Issues<Infer<S>>;

const makePath = (currentPath: string, prop: string) => {
  const index = Number(prop);
  const isArrayIndex = !Number.isNaN(index);
  const key = isArrayIndex ? `[${index}]` : prop;
  const dot = currentPath === "" || isArrayIndex ? "" : ".";
  return `${currentPath}${dot}${key}`;
};

/** key for translations: foo[1].bar => foo.bar */
export const getKey = (path: string) => path.replace(/\[\s*(\d+)\s*\]/g, "");

/**
 * Proxy used by both issues and form.helper
 */
function proxy(input: unknown, errors?: Errors) {
  errors ??= {};

  type Target = { path: string; value: any; length?: number };

  const handler = {
    get(target: Target, prop: string) {
      if (Array.isArray(target.value)) {
        if (prop === "length") return target.value.length;
        // array iterator
        if ((prop as any) === Symbol.iterator) {
          return function* (this: any) {
            for (let i = 0; i < target.value.length; ++i) {
              yield this[i];
            }
          };
        }
      }
      // issues.push
      if (prop === "push") {
        const { path, value } = target;
        return (error: string | ((key: string) => string)) => {
          if (typeof error === "function") {
            error = error(getKey(path));
          }
          addError(errors, path, error, value);
        };
      }
      // formHelper.path
      if (prop === "path") {
        return target.path;
      }
      // formHelper.value
      if (prop === "value") {
        const value = target.value ?? errors[target.path]?.value;
        return stringify(value);
      }
      // formHelper.errors
      if (prop === "errors") {
        return errors[target.path]?.errors ?? [];
      }
      const path = makePath(target.path, prop);
      const value =
        isArray(target.value) || isObject(target.value)
          ? (target.value as any)[prop]
          : undefined;
      return new Proxy({ path, value }, handler);
    },
  };

  return new Proxy({ path: "", value: input }, handler);
}
