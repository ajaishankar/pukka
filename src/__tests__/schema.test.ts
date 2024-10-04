import { describe, expect, test } from "vitest";
import { pukka as z } from "../pukka";
import { assertFail } from "./assert";

const ContactMethod = z.enum(["email", "phone"]);

const Call = z.object({
  type: z.literal("call"),
  landline: z.string({ required_error: () => "Landline is required" }),
});

const Text = z.object({
  type: z.literal("text"),
  mobile: z.string(),
});

const PhonePrefs = z.union([Call, Text]);

const SignupForm = z
  .object({
    email: z.string({ required_error: () => "Email is required" }),
    password: z.string(),
    passwordConfirm: z.string(),
    contactMethod: ContactMethod,
    phonePrefs: PhonePrefs.optional(),
    interests: z
      .array(z.string())
      .refine((ctx, arr) => arr.length > 0 || ctx.issue("No interests, huh?")),
  })
  .refineAsync(async (ctx, data) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (data.password !== data.passwordConfirm) {
      ctx.issue("Passwords don't match");
    }
  })
  .refine((ctx, data) => {
    if (data.contactMethod === "phone") {
      if (!ctx.isDefined(data.phonePrefs?.type)) {
        ctx.issue("Contact preference is required");
      } else {
        if (data.phonePrefs.type === "call") {
          console.log(data.phonePrefs.landline);
        } else {
          console.log(data.phonePrefs.mobile);
        }
      }
    }

    const interests = new Set<string>();

    for (const interest of data.interests) {
      if (interests.has(interest)) {
        ctx.issue(`Duplicate interest '${interest}'`);
      }
      interests.add(interest);
    }
  });

describe("object", () => {
  test("parse error", async () => {
    const result = await SignupForm.safeParseAsync({
      passwordConfirm: "   abc",
      contactMethod: "phone",
      /*
      phonePrefs: {
        type: "foo",
      },
      */
      interests: ["coding", undefined, "coding", "movies"],
    });

    assertFail(result);

    expect(result.input.passwordConfirm.value).toBe("   abc");
    expect(result.input.passwordConfirm.parsed).toBe("abc");
    expect(result.input.passwordConfirm.issues).toEqual([
      {
        code: "custom",
        message: "Passwords don't match",
      },
    ]);

    // console.log(JSON.stringify(data, null, 2));
  });
});
