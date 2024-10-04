import { afterEach, describe, expect, test } from "vitest";
import { CORE_ISSUES, isIssue } from "../issue";

const { required, invalid_type } = CORE_ISSUES;

describe("registerIssues", () => {
  afterEach(() => CORE_ISSUES.reset());

  test("is issue", () => {
    expect(isIssue({ code: "", message: "", path: [] })).toBe(true);
    expect(isIssue({ code: "" })).toBe(false);
    expect(isIssue({ message: "" })).toBe(false);
    expect(isIssue({ path: [] })).toBe(false);
    expect(isIssue(undefined)).toBe(false);
    expect(isIssue(null)).toBe(false);
    expect(isIssue(1)).toBe(false);
    expect(isIssue(true)).toBe(false);
    expect(isIssue("")).toBe(false);
    expect(isIssue({})).toBe(false);
    expect(isIssue([])).toBe(false);
  });

  test("can register issues", () => {
    expect(invalid_type.CODE).toBe("invalid_type");
    expect(required.CODE).toBe("required");

    const { code, message: msg1 } = invalid_type("string", {}, ["name"]);
    const { message: msg2 } = invalid_type("string", [], ["name"]);
    const { message: msg3 } = invalid_type("string", 1, ["name"]);

    expect(code).toBe("invalid_type");
    expect(msg1).toBe("Expected: string, Received: object");
    expect(msg2).toBe("Expected: string, Received: array");
    expect(msg3).toBe("Expected: string, Received: 1");

    const { code: code2, message: msg4 } = required(undefined, ["name"]);
    const { message: msg5 } = required(null, ["name"]);

    expect(code2).toBe("required");
    expect(msg4).toBe("Value is required, Received 'undefined'");
    expect(msg5).toBe("Value is required, Received 'null'");
  });

  test("can customize issues", () => {
    CORE_ISSUES.customize({
      invalid_type: () => "Invalid value",
      required: () => "Value cannot be empty",
    });
    const { message: msg1 } = invalid_type("string", {}, []);
    const { message: msg2 } = required(undefined, []);

    expect(msg1).toBe("Invalid value");
    expect(msg2).toBe("Value cannot be empty");
  });
});
