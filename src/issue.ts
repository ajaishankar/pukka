export type Path = (string | number)[];

export type Issue = {
  path: Path;
  code: string;
  message: string;
};

type Message = (...args: any[]) => string;

type IssueMap = Record<string, Message>;

type Issues<T extends IssueMap> = {
  [K in keyof T]: ((...args: Parameters<T[K]>) => {
    code: string;
    message: string;
  }) & {
    CODE: K;
  };
} & {
  customize: (overrides: Partial<T>) => void;
  reset: () => void;
};

export const isIssue = (value: any): value is Issue => {
  return value?.code != null && value?.message != null && value?.path != null;
};

export const registerIssues = <T extends IssueMap>(issueMap: T) => {
  let localMap = { ...issueMap };

  const issues = Object.fromEntries(
    Object.keys(localMap).map((code) => {
      const fn = (...args: any[]) => ({
        code,
        message: localMap[code](...args),
      });
      fn.CODE = code;
      return [code, fn];
    }),
  ) as unknown as Issues<T>;

  issues.customize = (overrides) => {
    for (const [key, fn] of Object.entries(overrides)) {
      (localMap as any)[key] = fn;
    }
  };

  issues.reset = () => {
    localMap = { ...issueMap };
  };

  return issues;
};

export const CORE_ISSUES = registerIssues({
  invalid_type: (expected: string, input: unknown, path: Path) => {
    const received = Array.isArray(input)
      ? "array"
      : typeof input === "object"
        ? "object"
        : input;
    return `Expected: ${expected}, Received: ${received}`;
  },
  required: (input: unknown, path: Path): string => {
    return `Value is required, Received '${input}'`;
  },
  exception: (e: Error, path: Path) => {
    return `Exception: ${e.message}`;
  },
});
