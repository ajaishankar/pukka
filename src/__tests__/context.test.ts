import { beforeEach, describe, expect, it, test } from "vitest";
import { IssueTrackingContext, ParseContextInternal } from "../internal";
import type { Issue } from "../issue";
import { StringType } from "../types";

describe("context", () => {
  describe("proxy", () => {
    const data = {
      homer: {
        addresses: [{ city: "" }],
      },
    };

    let ctx: ParseContextInternal;

    beforeEach(() => {
      ctx = new ParseContextInternal({});
    });

    it("should track current path", () => {
      ctx.withProxy(data, (data) => {
        data.homer;
        expect(ctx.path).toEqual(["homer"]);
        data.homer.addresses[0].city;
        expect(ctx.path).toEqual(["homer", "addresses", 0, "city"]);
      });
    });

    test("can get path for", () => {
      ctx.withProxy(data, (data) => {
        const path = ctx.pathFor(data.homer.addresses[0]);

        expect(path).toEqual(["homer", "addresses", 0]);
        expect(ctx.pathFor({})).toEqual([]);
        expect(ctx.pathFor(1 as any)).toEqual([]);
      });
    });

    it("should add issue for current path", () => {
      ctx.withProxy(data, (data) => {
        let issue: Issue | undefined;
        if (!data.homer.addresses[0].city) {
          issue = ctx.issue("City is required");
        }
        expect(issue?.path).toEqual(["homer", "addresses", 0, "city"]);
      });
    });
  });

  test("issue overloads", () => {
    const message = "major issue";
    const fn = () => "major issue";
    const code = "severe";
    const path = ["test"];

    const ctx = new ParseContextInternal({});

    const issue1 = ctx.issue(message);
    expect(issue1).toEqual({ code: "custom", message, path: [] });

    const issue2 = ctx.issue(message, path);
    expect(issue2).toEqual({ code: "custom", message, path });

    const issue3 = ctx.issue(fn);
    expect(issue3).toEqual({ code: "custom", message, path: [] });

    const issue4 = ctx.issue(fn, path);
    expect(issue4).toEqual({ code: "custom", message, path });

    const issue5 = ctx.issue(code, message);
    expect(issue5).toEqual({ code, message, path: [] });

    const issue6 = ctx.issue(code, message, path);
    expect(issue6).toEqual({ code, message, path });

    const issue7 = ctx.issue(code, fn);
    expect(issue7).toEqual({ code, message, path: [] });

    const issue8 = ctx.issue(code, fn, path);
    expect(issue8).toEqual({ code, message, path });

    const issue9 = ctx.issue({ code, message });
    expect(issue9).toEqual({ code, message, path: [] });

    const issue10 = ctx.issue({ code, message, path });
    expect(issue10).toEqual({ code, message, path });

    const issue11 = ctx.issue({ code, message: fn, path });
    expect(issue11).toEqual({ code, message, path });

    const issue12 = ctx.issue({ code, message: fn, path });
    expect(issue12).toEqual({ code, message, path });

    // conditional: true
    const issue13 = ctx.issue(true, message);
    expect(issue13).toEqual({ code: "custom", message, path: [] });

    const issue14 = ctx.issue(true, message, path);
    expect(issue14).toEqual({ code: "custom", message, path });

    const issue15 = ctx.issue(true, fn);
    expect(issue15).toEqual({ code: "custom", message, path: [] });

    const issue16 = ctx.issue(true, fn, path);
    expect(issue16).toEqual({ code: "custom", message, path });

    // conditional: false
    expect(ctx.issue(false, message)).toBeUndefined();
  });

  it("should not duplicate issue", () => {
    const ctx = new ParseContextInternal({});
    const issue = ctx.issue("major issue");

    ctx.issue(issue);
    expect(ctx.issueCount).toBe(1);

    ctx.addIssues([issue]);
    expect(ctx.issueCount).toBe(1);
  });

  test("can check if input is defined for current path", () => {
    const type = new StringType();
    const ctx = new ParseContextInternal({});
    ctx.withChildPath("name", () => {
      expect(ctx.isDefined("name")).toBe(false);
      ctx.setInput("homer", true, type);
      expect(ctx.isDefined("name")).toBe(true);
    });
  });

  test("can get runtime property", () => {
    type CheckUsername = (name: string) => boolean;

    const ctx = new ParseContextInternal({
      usernameAvailable: (name: string) => true,
    });

    expect(ctx.get<CheckUsername>("usernameAvailable")).toBeDefined();

    expect(() => ctx.get("foo")).toThrow("Context key missing: foo");
  });

  test("issue tracking context", () => {
    const ctx = new ParseContextInternal({ foo: 1 });
    ctx.issue("issue 1");

    const trk = new IssueTrackingContext(ctx);
    trk.issue("issue 2");

    expect(ctx.issueCount).toBe(2);
    expect(trk.newIssues.size).toBe(1);

    expect(trk.get("foo")).toBe(1);
    expect(trk.options).toBeDefined();
    expect(trk.pathFor({})).toBeDefined();
  });
});
