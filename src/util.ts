import type { ParsedInput } from "./base";
import type { Issue, Path } from "./issue";

export type Simplify<T> = { [KeyType in keyof T]: T[KeyType] } & {};

export function isObject(value: unknown): value is object {
  return typeof value === "object" && (value as any).constructor === Object;
}

export const getDisplayName = (path: Path) => {
  for (let i = path.length - 1; i >= 0; --i) {
    const key = path[i];
    if (typeof key === "string") {
      const first = key.substring(0, 1).toUpperCase();
      const rest = key
        .substring(1)
        .replace(/([a-z])([A-Z])/g, ([l, u]) => `${l} ${u}`);
      return `${first}${rest}`;
    }
  }
  return "";
};

export function toParsedInput<T>(
  data: T,
  getInput?: (path: Path) => {
    value: unknown | undefined;
    parsed: boolean;
    issues: Issue[];
  },
): ParsedInput<T> {
  const getResult = (path: Path, value: any) => {
    const input = getInput
      ? getInput(path)
      : { value, parsed: true, issues: [] };

    let result: any;

    if (isObject(value)) {
      result = {} as Record<string, any>;
      for (const [prop, item] of Object.entries(value)) {
        result[prop] = getResult([...path, prop], item);
      }
    } else if (Array.isArray(value)) {
      result = [] as any[];
      for (let i = 0; i < value.length; ++i) {
        result[i] = getResult([...path, i], value[i]);
      }
      result.toJSON = () => [...result, { issues: result.issues }];
    } else {
      result = {
        parsed: input.parsed ? value : undefined,
        value: input.value,
      };
    }

    result.issues = input.issues.map(({ code, message }) => ({
      code,
      message,
    }));

    return result;
  };

  return getResult([], data);
}

/**
 * Splits addresses[0].city to ['addresses', 0, 'city']
 */
const splitPath = (path: string) => {
  return path
    .trim()
    .replace(/\[\s*\]/g, ".[]") // leave [] alone
    .replace(/\[\s*(\w+)\s*\]/g, ".$1") // [foo] to .foo
    .replace(/^\.|\.$/, "") // trim('.')
    .split(".")
    .map((key) => {
      const num = Number.parseInt(key);
      return Number.isNaN(num) ? key : num;
    });
};

/**
 * Deeply sets value for a path
 * ```ts
 * setPath(target, 'addresses[0].city', 'Springfield')
 * ```
 */
const setPath = (target: Record<string, any>, path: string, value: unknown) => {
  const tokens = splitPath(path);

  let obj = target;
  let key = tokens[0];

  for (let i = 1; i < tokens.length; ++i) {
    const cur = tokens[i];
    const isArray = typeof cur === "number" || cur === "[]";
    if (!(key in obj)) {
      obj[key] = isArray ? [] : {};
    }
    obj = obj[key];
    key = cur === "[]" ? obj.length : cur;
  }

  // a=1&a=2
  if (key in obj) {
    if (!Array.isArray(obj[key])) {
      obj[key] = [obj[key]];
    }
    obj = obj[key];
    key = obj.length;
  }

  obj[key] = value;
};

export type DeepObject<ValueType> = {
  [key: string]: ValueType | ValueType[] | DeepObject<ValueType>;
};

export const DeepObject = {
  /**
   * Build a deeply nested object from `qs` paths
   * ```ts
   * const form = new FormData()
   * form.append("homer.addresses[0].city", "Springfield")
   * const object = DeepObject.fromEntries(form)
   * expect(object).toEqual({ homer: { addresses: [{ city: "Springfield" }] } })
   * ```
   */
  fromEntries<ValueType>(entries: Iterable<[string, ValueType]>) {
    const result = {};
    for (const [key, value] of entries) {
      setPath(result, key, value);
    }
    return result as DeepObject<ValueType>;
  },
};
