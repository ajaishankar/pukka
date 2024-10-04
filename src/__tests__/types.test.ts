import { describe, expect, it, test } from "vitest";
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
import { assertFail, assertSuccess } from "./assert";

describe("StringType", () => {
  it("should parse string", () => {
    const result = new StringType().safeParse("hello");
    expect(result).toEqual({ success: true, data: "hello" });
  });

  it("should return error on invalid string", () => {
    const result = new StringType().safeParse(undefined);
    assertFail(result);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("should trim string by default", () => {
    const result = new StringType().safeParse(" hello ");
    expect(result.data).toBe("hello");
  });

  it("can override trim via context", () => {
    const { data } = new StringType().safeParse(" hello ", {
      string: { trim: false },
    });
    expect(data).toBe(" hello ");
  });

  it("can override trim on instance", () => {
    const { data } = new StringType({ trim: false }).safeParse(" hello ");
    expect(data).toEqual(" hello ");

    const { data: data2 } = new StringType({ trim: true }).safeParse(
      " hello ",
      {
        string: { trim: false },
      },
    );
    expect(data2).toBe("hello");
  });

  it("should not coerce by default", () => {
    const { success } = new StringType().safeParse(1);
    expect(success).toBe(false);
  });

  it("can configure coerce on context", () => {
    const { data } = new StringType().safeParse(1, {
      string: { coerce: true },
    });
    expect(data).toBe("1");
  });

  it("can override coerce", () => {
    const { success } = new StringType({ coerce: false }).safeParse(1, {
      string: { coerce: true },
    });
    expect(success).toBe(false);
  });

  it("should not coerce null or undefined", () => {
    const { success: res1 } = new StringType({ coerce: true }).safeParse(null);
    expect(res1).toBe(false);

    const { success: res2 } = new StringType({ coerce: true }).safeParse(
      undefined,
    );
    expect(res2).toBe(false);
  });

  it("should not coerce object or array", () => {
    const { success: res1 } = new StringType().safeParse({});
    expect(res1).toBe(false);

    const { success: res2 } = new StringType().safeParse([]);
    expect(res2).toBe(false);
  });

  it("should allow empty strings by default", () => {
    const { success } = new StringType().safeParse("");
    expect(success).toBe(true);
  });

  test("can configure empty on context", () => {
    const { success, issues } = new StringType().safeParse("", {
      string: { empty: false },
    });
    expect(success).toBe(false);
    expect(issues).toEqual([
      { code: "required", message: "Value is required, Received ''", path: [] },
    ]);
  });

  test("can override empty on instance", () => {
    const { success } = new StringType({ empty: true }).safeParse("", {
      string: { empty: false },
    });
    expect(success).toBe(true);
  });

  it("should treat blank string as empty", () => {
    const { success, issues } = new StringType({
      empty: false,
    }).safeParse("    ");

    expect(success).toBe(false);
    expect(issues).toEqual([
      {
        code: "required",
        message: "Value is required, Received '    '",
        path: [],
      },
    ]);
  });

  it("should not treat blank string as empty if trim is false", () => {
    const { success } = new StringType({
      empty: false,
      trim: false,
    }).safeParse("    ");

    expect(success).toBe(true);
  });
});

describe("NumberType", () => {
  it("should parse number", () => {
    const result = new NumberType().safeParse(1);
    expect(result).toEqual({ success: true, data: 1 });
  });

  it("should return error on invalid number", () => {
    const result = new NumberType().safeParse("abcd");
    assertFail(result);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("should not coerce by default", () => {
    const { success } = new NumberType().safeParse("1");
    expect(success).toBe(false);
  });

  it("can configure coerce on context", () => {
    const { data } = new NumberType().safeParse("1", {
      number: { coerce: true },
    });
    expect(data).toBe(1);
  });

  it("can override coerce", () => {
    const { success } = new NumberType({ coerce: false }).safeParse("1", {
      number: { coerce: true },
    });
    expect(success).toBe(false);
  });

  it("should not coerce null or undefined", () => {
    const { success: res1 } = new NumberType().safeParse(null);
    expect(res1).toBe(false);

    const { success: res2 } = new NumberType().safeParse(undefined);
    expect(res2).toBe(false);
  });

  it("should not coerce invalid input", () => {
    const { success } = new NumberType({ coerce: true }).safeParse("foo");
    expect(success).toBe(false);
  });
});

describe("BooleanType", () => {
  it("should parse boolean", () => {
    const result = new BooleanType().safeParse(true);
    expect(result).toEqual({ success: true, data: true });

    const result2 = new BooleanType().safeParse(false);
    expect(result2).toEqual({ success: true, data: false });
  });

  it("should return error on invalid boolean", () => {
    const result = new BooleanType().safeParse(undefined);
    assertFail(result);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("should not coerce by default", () => {
    const { success } = new BooleanType().safeParse(1);
    expect(success).toBe(false);
  });

  it("can configure coerce on context", () => {
    const { data } = new BooleanType().safeParse(1, {
      boolean: { coerce: true },
    });
    expect(data).toBe(true);
  });

  it("can override coerce", () => {
    const { success } = new BooleanType({ coerce: false }).safeParse(1, {
      boolean: { coerce: true },
    });
    expect(success).toBe(false);
  });

  it("should not coerce null or undefined", () => {
    const { success: res1 } = new BooleanType().safeParse(null);
    expect(res1).toBe(false);

    const { success: res2 } = new BooleanType().safeParse(undefined);
    expect(res2).toBe(false);
  });
});

describe("EnumType", () => {
  const ContactMethod = new EnumType(["email", "phone"]);

  it("should parse enum", () => {
    const result = ContactMethod.safeParse("email");
    expect(result).toEqual({ success: true, data: "email" });

    const result2 = ContactMethod.safeParse("phone");
    expect(result2).toEqual({ success: true, data: "phone" });
  });

  it("should return error on invalid enum", () => {
    const result = ContactMethod.safeParse("foobar");
    assertFail(result);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

describe("LiteralType", () => {
  it("should parse string literal", () => {
    const result = new StringLiteralType("hello").safeParse("hello");
    expect(result).toEqual({ success: true, data: "hello" });
  });

  it("should parse numeric literal", () => {
    const result = new NumberLiteralType(1).safeParse(1);
    expect(result).toEqual({ success: true, data: 1 });
  });

  it("should parse boolean literal", () => {
    const result = new BooleanLiteralType(true).safeParse(true);
    expect(result).toEqual({ success: true, data: true });
  });

  it("should return error on invalid enum", () => {
    const result = new BooleanLiteralType(true).safeParse(false);
    assertFail(result);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

describe("FileType", () => {
  it("should parse file", () => {
    const result = new FileType().safeParse(new File([], "test.txt"));
    assertSuccess(result);
    expect(result.data).toBeInstanceOf(File);
  });

  it("should return error on invalid file", () => {
    const result = new FileType().safeParse("hello");
    assertFail(result);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

describe("RecordType", () => {
  const recordType = new RecordType(new NumberType());

  it("should parse record", () => {
    const result = recordType.safeParse({ one: 1, two: 2 });
    assertSuccess(result);
    expect(result.data).toEqual({ one: 1, two: 2 });
  });

  it("should return error on invalid record", () => {
    const result = recordType.safeParse("hello");
    assertFail(result);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues).toEqual([
      {
        path: [],
        code: "invalid_type",
        message: "Expected: record, Received: hello",
      },
    ]);
  });

  it("should return error on invalid record entries", () => {
    const result = recordType.safeParse({ one: 1, two: "dos" });
    assertFail(result);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues).toEqual([
      {
        path: ["two"],
        code: "invalid_type",
        message: "Expected: number, Received: dos",
      },
    ]);
  });
});

describe("ObjectType", () => {
  const objectType = new ObjectType({
    name: new StringType(),
    age: new NumberType(),
  });

  it("should parse object", () => {
    const result = objectType.safeParse({ name: "homer", age: 42 });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: "homer", age: 42 });
  });

  it("should remove extra keys", () => {
    const result = objectType.safeParse({ name: "homer", age: 42, foo: "bar" });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: "homer", age: 42 });
  });

  it("should return error on invalid object", () => {
    const result = objectType.safeParse("hello");
    assertFail(result);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues).toEqual([
      {
        path: [],
        code: "invalid_type",
        message: "Expected: object, Received: hello",
      },
    ]);
  });

  it("should return error on invalid object properties", () => {
    const result = objectType.safeParse({ name: "homer", age: "unknown" });
    assertFail(result);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues).toEqual([
      {
        path: ["age"],
        code: "invalid_type",
        message: "Expected: number, Received: unknown",
      },
    ]);
  });
});

describe("ArrayType", () => {
  it("should parse array", () => {
    const result = new ArrayType(new NumberType()).safeParse([1, 2]);
    expect(result).toEqual({ success: true, data: [1, 2] });
  });

  it("should return error on invalid array", () => {
    const result = new ArrayType(new NumberType()).safeParse(1);
    assertFail(result);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("can coerce input", () => {
    const result = new ArrayType(new NumberType(), { coerce: true }).safeParse(
      1,
    );
    expect(result).toEqual({ success: true, data: [1] });
  });

  it("should still return error on invalid array", () => {
    const result = new ArrayType(new NumberType(), { coerce: true }).safeParse(
      "abcd",
    );
    assertFail(result);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

describe("UnionType", () => {
  const unionType = new UnionType([
    new ObjectType({
      type: new StringLiteralType("string"),
      stringValue: new StringType(),
    }),
    new ObjectType({
      type: new StringLiteralType("number"),
      numericValue: new NumberType(),
    }),
  ]);

  it("should parse union", () => {
    const result = unionType.safeParse({
      type: "string",
      stringValue: "hello",
    });
    expect(result).toEqual({
      success: true,
      data: {
        type: "string",
        stringValue: "hello",
      },
    });
    const result2 = unionType.safeParse({
      type: "number",
      numericValue: 1,
    });
    expect(result2).toEqual({
      success: true,
      data: {
        type: "number",
        numericValue: 1,
      },
    });
  });

  it("should return error on invalid union", () => {
    const result = unionType.safeParse({
      type: "number",
      numericValue: "abcd",
    });
    assertFail(result);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("should parse union of different shapes", () => {
    const unionType = new UnionType([
      new ObjectType({
        name: new StringType(),
      }),
      new NumberType(),
    ]);

    const result = unionType.safeParse({
      name: "homer",
    });
    expect(result).toEqual({
      success: true,
      data: { name: "homer" },
    });

    const result2 = unionType.safeParse(1);
    expect(result2).toEqual({ success: true, data: 1 });
  });

  it("cannot create union with no types", () => {
    expect(() => new UnionType([])).toThrow(
      "UnionType options cannot be empty",
    );
  });
});
