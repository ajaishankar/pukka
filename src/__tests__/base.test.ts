import { describe, expect, expectTypeOf, it, test } from "vitest";
import {
  type BaseType,
  type Infer,
  ParseError,
  type Type,
  getPathType,
} from "../base";
import { internalType } from "../internal";
import { pukka as z } from "../pukka";

import { ContextKeyError } from "../context";
import { CORE_ISSUES } from "../issue";
import { StringType } from "../types";
import { assertFail } from "./assert";

const { invalid_type, required } = CORE_ISSUES;

interface Dhs {
  isInNoFlyList(traveler: Traveler): Promise<boolean>;
}

type Traveler = Infer<typeof Traveler>;

const Traveler = z
  .object({
    name: z.string({
      invalid_type_error: (ctx) => ctx.issue("invalid", "Invalid name"),
      required_error: "Name is required",
    }),
    age: z
      .number()
      .refine(
        (ctx, value) => value > 0 || ctx.issue("Age must be greater than 0"),
      ),
  })
  .refine((ctx, traveler) => [
    ctx.isDefined(traveler.age)
      ? traveler.age > 4 || ctx.issue("Cannot travel alone")
      : true,
  ]);

const RiskyTraveler = Traveler.refineAsync(async (ctx, traveler) => {
  const banned = await ctx.get<Dhs>("dhs").isInNoFlyList(traveler);
  if (banned) {
    ctx.issue({
      code: "custom",
      message: "Traveler is in no fly list",
      path: [],
    });
  }
});

const ExceptionalSchema = z
  .object({
    name: z.string().refine(() => {
      throw new Error("child exception");
    }),
  })
  .refineAsync(async () => {
    throw new Error("parent exception");
  });

const ContextKeyErrorSchema = z.string().refine((ctx) => {
  ctx.get("foo");
});

const ContextKeyErrorSchemaAsync = z.string().refineAsync(async (ctx) => {
  ctx.get("foo");
});

describe("base type", () => {
  const dhs: Dhs = {
    isInNoFlyList: (traveler) => Promise.resolve(traveler.name === "bart"),
  };

  test("override", () => {
    const result = Traveler.safeParse({ name: {}, age: null });
    assertFail(result);
    expect(result.issues).toEqual([
      { path: ["name"], code: "invalid", message: "Invalid name" },
      {
        path: ["age"],
        code: "required",
        message: "Value is required, Received 'null'",
      },
    ]);
  });

  it("should run child refine", () => {
    const result = Traveler.safeParse({ name: "maggie", age: 0 });
    assertFail(result);
    expect(result.issues).toEqual([
      { path: ["age"], code: "custom", message: "Age must be greater than 0" }, // child
      { path: ["age"], code: "custom", message: "Cannot travel alone" }, // parent
    ]);
  });

  describe("clone", () => {
    test("optional", () => {
      const a = z.string();
      const b = a.optional();
      expect(b).not.toBe(a);
    });

    test("nullable", () => {
      const a = z.string();
      const b = a.nullable();
      expect(b).not.toBe(a);
    });

    test("issues", () => {
      const a = z.string();
      const b = a.issues({});
      expect(b).not.toBe(a);
    });

    test("refine", () => {
      expect(RiskyTraveler).not.toBe(Traveler);
    });
  });

  describe("safeParse", () => {
    test("success", () => {
      const result = Traveler.safeParse({ name: "homer", age: 42 });
      expect(result.data).toEqual({ name: "homer", age: 42 });
    });

    test("error", () => {
      const result = Traveler.safeParse({ name: "maggie", age: 1 });
      assertFail(result);
      expect(result.issues.length).toBe(1);
      expect(result.input.age.issues).toEqual([
        { code: "custom", message: "Cannot travel alone" },
      ]);
    });

    it("should throw exception if async validators present", () => {
      expect(() => RiskyTraveler.safeParse({})).toThrow(
        "Asynchronous validators present, call parseAsync or safeParseAsync",
      );
    });

    it("should rethrow context key error", () => {
      expect(() => ContextKeyErrorSchema.safeParse("")).toThrow(
        ContextKeyError,
      );
    });
  });

  describe("parse", () => {
    test("success", () => {
      const data = Traveler.parse({ name: "homer", age: 42 });
      expect(data).toEqual({ name: "homer", age: 42 });
    });

    test("error", () => {
      expect.assertions(2);
      try {
        Traveler.parse({ name: "maggie", age: 1 });
      } catch (e) {
        if (e instanceof ParseError) {
          expect(e.issues.length).toBe(1);
          const input = e.input(Traveler);
          expect(input.age.issues).toEqual([
            { code: "custom", message: "Cannot travel alone" },
          ]);
        }
      }
    });

    it("should rethrow context key error", () => {
      expect(() => ContextKeyErrorSchema.parse("")).toThrow(ContextKeyError);
    });
  });

  describe("safeParseAsync", () => {
    test("success", async () => {
      const result = await RiskyTraveler.safeParseAsync(
        { name: "homer", age: 42 },
        { dhs },
      );
      expect(result.data).toEqual({ name: "homer", age: 42 });
    });

    test("error", async () => {
      const result = await Traveler.safeParseAsync(
        { name: "maggie", age: 1 },
        { dhs },
      );
      assertFail(result);
      expect(result.issues.length).toBe(1);
      expect(result.input.age.issues).toEqual([
        { code: "custom", message: "Cannot travel alone" },
      ]);
    });

    test("async error", async () => {
      const result = await RiskyTraveler.safeParseAsync(
        {
          name: "bart",
          age: 10,
        },
        { dhs },
      );
      assertFail(result);
      expect(result.issues.length).toBe(1);
      expect(result.input.issues).toEqual([
        { code: "custom", message: "Traveler is in no fly list" },
      ]);
    });

    it("should rethrow context key error", () => {
      expect(ContextKeyErrorSchemaAsync.safeParseAsync("")).rejects.toThrow(
        ContextKeyError,
      );
    });
  });

  describe("parseAsync", () => {
    test("success", async () => {
      const data = await RiskyTraveler.parseAsync(
        { name: "homer", age: 42 },
        { dhs },
      );
      expect(data).toEqual({ name: "homer", age: 42 });
    });

    test("error", async () => {
      expect.assertions(2);
      try {
        await Traveler.parseAsync({ name: "maggie", age: 1 }, { dhs });
      } catch (e) {
        if (e instanceof ParseError) {
          const input = e.input(Traveler);
          expect(e.issues.length).toBe(1);
          expect(input.age.issues).toEqual([
            { code: "custom", message: "Cannot travel alone" },
          ]);
        }
      }
    });

    test("async error", async () => {
      expect.assertions(2);
      try {
        await RiskyTraveler.parseAsync(
          {
            name: "bart",
            age: 10,
          },
          { dhs },
        );
      } catch (e) {
        if (e instanceof ParseError) {
          const input = e.input(RiskyTraveler);
          expect(e.issues.length).toBe(1);
          expect(input.issues).toEqual([
            { code: "custom", message: "Traveler is in no fly list" },
          ]);
        }
      }
    });

    it("should rethrow context key error", () => {
      expect(ContextKeyErrorSchemaAsync.parseAsync("")).rejects.toThrow(
        ContextKeyError,
      );
    });
  });

  test("core issue overrides", () => {
    const str1 = z.string({
      invalid_type_error: "invalid",
      required_error: "required",
    });

    const str2 = z.string({
      invalid_type_error: () => "invalid",
      required_error: () => "required",
    });

    const str3 = z.string({
      invalid_type_error: (ctx) => ctx.issue(invalid_type.CODE, "invalid"),
      required_error: (ctx) => ctx.issue(required.CODE, "required"),
    });

    const results = {
      invalid: [str1.safeParse(1), str2.safeParse(1), str3.safeParse(1)],
      required: [
        str1.safeParse(undefined),
        str2.safeParse(undefined),
        str3.safeParse(undefined),
      ],
    };

    for (const res of results.invalid) {
      assertFail(res);
      expect(res.issues.length).toBe(1);
      expect(res.issues[0].code).toBe(invalid_type.CODE);
      expect(res.issues[0].message).toBe("invalid");
    }

    for (const res of results.required) {
      assertFail(res);
      expect(res.issues.length).toBe(1);
      expect(res.issues[0].code).toBe(required.CODE);
      expect(res.issues[0].message).toBe("required");
    }
  });

  test("validation exception", async () => {
    const result = await ExceptionalSchema.safeParseAsync({ name: "homer" });
    assertFail(result);
    expect(result.issues).toEqual([
      {
        path: ["name"],
        code: "exception",
        message: "Exception: child exception",
      },
      {
        path: [],
        code: "exception",
        message: "Exception: parent exception",
      },
    ]);
  });

  test("non literal", () => {
    expect(() => internalType(z.string()).literalValue).toThrow(
      "Not a literal type",
    );
  });
});

describe("getPathType", () => {
  const arr = z.array(
    z.object({
      name: z.string(),
      addresses: z.array(
        z.object({
          street: z.string(),
        }),
      ),
    }),
  );

  test("const path should return Type<T>", () => {
    const s = getPathType(arr, [0, "addresses", 1, "street"] as const);
    expect(s).toBeInstanceOf(StringType);
    expectTypeOf(s).toEqualTypeOf<Type<string>>();
    expectTypeOf("123 some st").toEqualTypeOf<Infer<typeof s>>();
  });

  test("path should return BaseType", () => {
    const s = getPathType(arr, [0, "addresses", 1, "street"]);
    expectTypeOf(s).toEqualTypeOf<BaseType | undefined>();
    expect(s).toBeInstanceOf(StringType);
  });

  test("invalid path should return undefined", () => {
    const s = getPathType(arr, [0, "addresses", "foo"] as const);
    expectTypeOf(s).toEqualTypeOf<BaseType | undefined>();
    expect(s).toBeUndefined();
  });

  test("partial validation", () => {
    // Type<string>
    const type1 = getPathType(arr, [0, "addresses", 1, "street"] as const);
    expect(type1.safeParse("123 some st").success).toBe(true);

    // BaseType
    const type2 = getPathType(arr, [0, "addresses", 1, "street"]);
    expect(type2?.safeParse("123 some st")?.success).toBe(true);
  });
});
