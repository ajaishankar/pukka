import { describe, expect, it, test } from "vitest";
import { Type } from "../base";
import { Extensions } from "../extend";
import { type Path, registerIssues } from "../issue";
import { pukka } from "../pukka";
import { NumberType, StringType } from "../types";
import { assertFail } from "./assert";

const params = Extensions.getParams;

const STRING_ISSUES = registerIssues({
  min_length: (length: number, path?: Path) => {
    return `Value should be ${length} or more characters long`;
  },
  username_taken: (name: string, path?: Path) => `${name} is already taken`,
});

const { min_length, username_taken } = STRING_ISSUES;

const StringExtensions1 = Extensions.for(StringType, {
  min: (length: number) => (ctx, value) =>
    value.length >= length || ctx.issue(min_length(length, ctx.path)),
});

const StringExtensions2 = Extensions.forAsync(StringType, {
  username: () => async (ctx, value) =>
    value === "homer" ? ctx.issue(username_taken(value)) : true,
});

const InvalidStringExtension = Extensions.for(StringType, {
  optional: () => (ctx) => ctx.issue("nope"),
});

const GenericExtension = Extensions.for(Type<unknown>, {
  description: (desc: string) => (ctx, value) => true,
});

const StringExtensions = {
  ...StringExtensions1,
  ...StringExtensions2,
  ...InvalidStringExtension,
  ...GenericExtension,
};

const extendedString = Extensions.apply(StringType, StringExtensions);
const extendedNumber = Extensions.apply(NumberType, GenericExtension);

const z = {
  ...pukka,
  string: extendedString(pukka.string),
  number: extendedNumber(pukka.number),
};

describe("extend", () => {
  it("should be of correct type", () => {
    expect(z.string().min(2).username()).toBeInstanceOf(StringType);
  });

  it("should clone", () => {
    const a = z.string();
    const b = a.min(2);
    expect(b).not.toBe(a);
  });

  it("should not extend existing method", () => {
    const a = z.string().optional();
    expect(a.isOptional).toBe(true);
    expect(a.safeParse(undefined).success).toBe(true);
  });

  it("should capture params", async () => {
    const name = z.string().min(2);
    expect(params(name, StringExtensions, "min")).toEqual([2]);
    expect(params(name, StringExtensions, "username")).toBeUndefined();
    const name2 = name.username().min(2);
    expect(params(name2, StringExtensions, "username")).toEqual([]);
  });

  test("generic extension", () => {
    const str = z.string().description("string");
    const num = z.number().description("number");
    expect(params(str, GenericExtension, "description")).toEqual(["string"]);
    expect(params(num, GenericExtension, "description")).toEqual(["number"]);
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
