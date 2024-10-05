import { describe, expect, it, test } from "vitest";
import { DeepObject, getDisplayName, isObject, toParsedInput } from "../util";

test("getDisplayName", () => {
  expect(getDisplayName([])).toBe("");
  expect(getDisplayName([1])).toBe("");
  expect(getDisplayName(["orders", 0, "orderNumber"])).toBe("Order Number");
  expect(getDisplayName(["orders", 0])).toBe("Orders");
});

test("isObject", () => {
  expect(isObject({})).toBe(true);
  expect(isObject([])).toBe(false);
  expect(isObject(new Date())).toBe(false);
});

test("toParsedInput", () => {
  const data = toParsedInput({
    name: "homer",
    children: ["bart", "lisa", "maggie"],
  });

  const children = [
    { parsed: "bart", value: "bart", issues: [] },
    { parsed: "lisa", value: "lisa", issues: [] },
    { parsed: "maggie", value: "maggie", issues: [] },
  ];

  expect(data.name).toEqual({ parsed: "homer", value: "homer", issues: [] });
  expect(data.issues).toEqual([]);
  expect(data.children.value[0]).toEqual(children[0]);
  expect(data.children.value[1]).toEqual(children[1]);
  expect(data.children.value[2]).toEqual(children[2]);
  expect(data.children.issues).toEqual([]);
});

describe("DeepObject.fromEntries", () => {
  it("can parse form data", () => {
    const form = new FormData();

    form.append("a", "1");
    form.append("a", "2");
    form.append("b", "1");

    expect(DeepObject.fromEntries(form)).toEqual({
      a: ["1", "2"],
      b: "1",
    });
  });

  it("can parse url search params", () => {
    const search = new URLSearchParams();

    search.append("a", "1");
    search.append("a", "2");
    search.append("b", "1");

    expect(DeepObject.fromEntries(search)).toEqual({
      a: ["1", "2"],
      b: "1",
    });
  });

  it("can parse deeply nested object", () => {
    const obj = DeepObject.fromEntries([
      ["a", "1"],
      ["b", "2"],
      ["[c]", "3"],
      ["d.e", "4"],
      ["[f][g]", "5"],
      ["h.i[1]", "7"],
      ["h.i[0]", "6"],
      ["h.i[]", "8"],
      ["j[][k]", "9"],
      ["l.m[0].n", "10"],
      ["[o][p][0][q]", "11"],
      ["r", "12"],
      ["r", "13"],
      ["r", "14"],
      ["s.t.u.v", "15"],
      ["s.t.u.w", "16"],
      ["s.t.u.w", "17"],
    ]);

    expect(obj).toEqual({
      a: "1",
      b: "2",
      c: "3",
      d: { e: "4" },
      f: { g: "5" },
      h: { i: ["6", "7", "8"] },
      j: [{ k: "9" }],
      l: {
        m: [{ n: "10" }],
      },
      o: {
        p: [{ q: "11" }],
      },
      r: ["12", "13", "14"],
      s: { t: { u: { v: "15", w: ["16", "17"] } } },
    });
  });
});
