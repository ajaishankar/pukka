import { describe, expect, expectTypeOf, test } from "vitest";
import type { Infer } from "../base";
import { pukka as z } from "../pukka";
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
} from "../types";

describe("types", () => {
  test("string", () => {
    expect(z.string()).toBeInstanceOf(StringType);
  });
  test("number", () => {
    expect(z.number()).toBeInstanceOf(NumberType);
  });
  test("boolean", () => {
    expect(z.boolean()).toBeInstanceOf(BooleanType);
  });
  test("enum", () => {
    expect(z.enum(["male", "female"])).toBeInstanceOf(EnumType);
  });
  test("file", () => {
    expect(z.file()).toBeInstanceOf(FileType);
  });
  test("string literal", () => {
    expect(z.literal("type")).toBeInstanceOf(StringLiteralType);
  });
  test("numeric literal", () => {
    expect(z.literal(1)).toBeInstanceOf(NumberLiteralType);
  });
  test("boolean literal", () => {
    expect(z.literal(true)).toBeInstanceOf(BooleanLiteralType);
  });
  test("record", () => {
    expect(z.record(z.number())).toBeInstanceOf(RecordType);
  });
  test("object", () => {
    expect(z.object({ name: z.string() })).toBeInstanceOf(ObjectType);
  });
  test("array", () => {
    expect(z.array(z.string())).toBeInstanceOf(ArrayType);
  });
  test("union", () => {
    expect(z.union([z.string(), z.number()])).toBeInstanceOf(UnionType);
  });
});

describe("typecheck", () => {
  test("string", () => {
    const str = z.string();
    expectTypeOf("").toEqualTypeOf<Infer<typeof str>>();
  });

  test("number", () => {
    const num = z.number();
    expectTypeOf(0).toEqualTypeOf<Infer<typeof num>>();
  });

  test("boolean", () => {
    const bool = z.boolean();
    expectTypeOf(true).toEqualTypeOf<Infer<typeof bool>>();
    expectTypeOf(false).toEqualTypeOf<Infer<typeof bool>>();
  });

  test("enum", () => {
    const enm = z.enum(["email", "phone"]);
    expectTypeOf("email" as const).toMatchTypeOf<Infer<typeof enm>>();
    expectTypeOf("phone" as const).toMatchTypeOf<Infer<typeof enm>>();
    expectTypeOf("foo").not.toMatchTypeOf<Infer<typeof enm>>();
  });

  test("file", () => {
    const file = z.file();
    expectTypeOf(new File([], "a.txt")).toEqualTypeOf<Infer<typeof file>>();
  });

  test("string literal", () => {
    const lit = z.literal("email");
    expectTypeOf("email" as const).toEqualTypeOf<Infer<typeof lit>>();
    expectTypeOf("foo").not.toMatchTypeOf<Infer<typeof lit>>();
  });

  test("numeric literal", () => {
    const lit = z.literal(1);
    expectTypeOf(1 as const).toEqualTypeOf<Infer<typeof lit>>();
    expectTypeOf(2 as const).not.toEqualTypeOf<Infer<typeof lit>>();
  });

  test("boolean literal", () => {
    const lit = z.literal(true);
    expectTypeOf(true as const).toEqualTypeOf<Infer<typeof lit>>();
    expectTypeOf(false as const).not.toEqualTypeOf<Infer<typeof lit>>();
  });

  test("record", () => {
    const rec = z.record(z.number());
    expectTypeOf({ a: 1 }).toMatchTypeOf<Infer<typeof rec>>();
    expectTypeOf({ a: "foo" }).not.toMatchTypeOf<Infer<typeof rec>>();
  });

  test("object", () => {
    const obj = z.object({
      name: z.string(),
      age: z.number(),
      single: z.boolean().optional(),
    });

    expectTypeOf({
      name: "test",
      age: 42,
      single: false as boolean | undefined,
    }).toEqualTypeOf<Infer<typeof obj>>();

    const opt = obj.optional();
    expectTypeOf(undefined).toMatchTypeOf<Infer<typeof opt>>();
  });

  test("array", () => {
    const arr = z.array(
      z.object({
        name: z.string(),
      }),
    );

    expectTypeOf([{ name: "test" }]).toEqualTypeOf<Infer<typeof arr>>();

    const opt = arr.optional();
    expectTypeOf(undefined).toMatchTypeOf<Infer<typeof opt>>();
  });

  test("union", () => {
    const union = z.union([z.string(), z.number()]);
    expectTypeOf("").toMatchTypeOf<Infer<typeof union>>();
    expectTypeOf(1).toMatchTypeOf<Infer<typeof union>>();
    expectTypeOf(true).not.toMatchTypeOf<Infer<typeof union>>();
  });

  test("nested", () => {
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

    expectTypeOf([
      { name: "test", addresses: [{ street: "123 some st" }] },
    ]).toEqualTypeOf<Infer<typeof arr>>();
  });

  test("optional & nullable", () => {
    const str = z.string();
    const opt = z.string().optional();
    const nul = z.string().nullable();
    const nop = z.string().nullable().optional();
    const opn = z.string().optional().nullable();

    expectTypeOf("").toEqualTypeOf<Infer<typeof str>>();

    expectTypeOf("").toMatchTypeOf<Infer<typeof opt>>();
    expectTypeOf(undefined).toMatchTypeOf<Infer<typeof opt>>();

    expectTypeOf("").toMatchTypeOf<Infer<typeof nul>>();
    expectTypeOf(null).toMatchTypeOf<Infer<typeof nul>>();

    expectTypeOf("").toMatchTypeOf<Infer<typeof nop>>();
    expectTypeOf(undefined).toMatchTypeOf<Infer<typeof nop>>();
    expectTypeOf(null).toMatchTypeOf<Infer<typeof nul>>();

    expectTypeOf("").toMatchTypeOf<Infer<typeof opn>>();
    expectTypeOf(undefined).toMatchTypeOf<Infer<typeof opn>>();
    expectTypeOf(null).toMatchTypeOf<Infer<typeof opn>>();
  });
});
