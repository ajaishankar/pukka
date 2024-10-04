import { describe, expect, it, test } from "vitest";
import type { MessageOverride } from "../base";
import { applyExtensions, getExtensionParams as params } from "../extend";
import { type Path, registerIssues } from "../issue";
import { pukka } from "../pukka";
import { StringType } from "../types";
import { assertFail } from "./assert";

const STRING_ISSUES = registerIssues({
  min_length: (length: number, path?: Path) => {
    return `Value should be ${length} or more characters long`;
  },
  username_taken: (name: string, path?: Path) => `${name} is already taken`,
});

const { min_length, username_taken } = STRING_ISSUES;

class StringExtensions1 extends StringType {
  min(length: number, override?: MessageOverride) {
    return super.extend("min", [length], override, (ctx, value) => {
      value.length >= length || ctx.issue(min_length(length, ctx.path));
    });
  }
}

class StringExtensions2 extends StringType {
  max(length: number, override?: MessageOverride) {
    return super.extend("max", [length], override, (ctx, value) => {
      return (
        value.length <= length ||
        ctx.issue(`Value should be less than ${length} characters long`)
      );
    });
  }
}

class StringExtensions3 extends StringType {
  username(override?: MessageOverride) {
    return super.extendAsync("username", [], override, (ctx, value) => {
      return Promise.resolve(
        value === "homer" ? ctx.issue(username_taken(value)) : true,
      );
    });
  }
}

const withStringExtensions = applyExtensions(
  StringType,
  StringExtensions1,
  StringExtensions2,
  StringExtensions3,
);

const z = {
  ...pukka,
  string: withStringExtensions(pukka.string),
};

describe("extend", () => {
  it("should be of correct type", () => {
    expect(z.string().min(2)).toBeInstanceOf(StringType);
  });

  it("should clone", () => {
    const a = z.string();
    const b = a.min(2);
    expect(b).not.toBe(a);
  });

  it("should capture params", async () => {
    const name = z.string().min(2);
    expect(params(name, StringExtensions1, "min")).toEqual([2]);
    expect(params(name, StringExtensions3, "username")).toBeUndefined();
    const name2 = name.username();
    expect(params(name2, StringExtensions3, "username")).toEqual([]);
  });

  it("should invoke extensions", async () => {
    const name = z.string().min(2).username();

    const result1 = await name.safeParseAsync("a");
    assertFail(result1);
    expect(result1.issues).toEqual([
      {
        code: "min_length",
        message: "Value should be 2 or more characters long",
        path: [],
      },
    ]);

    const result2 = await name.safeParseAsync("homer");
    assertFail(result2);
    expect(result2.issues).toEqual([
      {
        code: "username_taken",
        message: "homer is already taken",
        path: [],
      },
    ]);
  });

  test("can override issues", async () => {
    const name = z
      .string()
      .min(2, { message: "Invalid name" })
      .username({ message: () => "Username exists" });

    const result = await name.safeParseAsync("ab");
    assertFail(result);
    expect(result.issues).toEqual([
      { code: "custom", message: "Invalid name", path: [] },
      { code: "custom", message: "Username exists", path: [] },
    ]);
  });
});
