[![version(scoped)](https://img.shields.io/npm/v/pukka.svg)](https://www.npmjs.com/package/pukka)
[![codecov](https://codecov.io/gh/ajaishankar/pukka/graph/badge.svg?token=2O9DD5SEUJ)](https://codecov.io/gh/ajaishankar/pukka)

# pukka!

pukka is a Typescript schema-first, zod compatible, headless validation library.

It aims to completely separate schema from validation. With pukka, unlike other libraries, there is no need for field level validation chains.

You're free to do your validations, your way... in a single place!

pukka simplifies common data validation tasks - trim strings, data coercion, conditional validation, async validation, deeply nested field validation, external dependencies during validation, deserialize nested form data, render form fields with errors, schema reuse on browser and server, error message customization, internationalization, or even partial validation!

Designed to be extensible, pukka makes it easy to add new types or even implement field level zod like validators!

## Install
```
npm install pukka
```

## Usage

Define a schema as usual, and consolidate validations.

```ts
import { z } from "pukka";

const Register = z
  .object({
    email: z.string(),
    password: z.string(),
    confirm: z.string(),
  })
  .refine((ctx, data) => {
    ctx.issue(data.email.length === 0, "Please enter your email");
    ctx.issue(data.password.length < 8, "Password should be 8 or more characters");
    if (data.password !== data.confirm) {
      ctx.issue("Passwords don't match");
    }
  });

const data = Register.parse({ password: "secret" });

const { success, data, issues, input } = Register.safeParse({
  password: "secret",
});
```

On validation error, pukka automatically tags each field with its issues!

There is no need to explicity specify the error field path.

## API

pukka has just a handful of APIs.

Every schema has the following methods.

```ts
schema.optional()
schema.nullable()

schema.refine((ctx, data) => {...})
schema.refineAsync(async (ctx, data) => {...})

schema.parse(input, options)
schema.parseAsync(input, options)

schema.safeParse(input, options)
schema.safeParseAsync(input, options)
```

And the following are available on the context.

```ts
schema.refine((ctx, data) => {
  data.foo.bar[0] // access a field

  ctx.path // ["foo", "bar", 0]
  ctx.issue("major issue") // raise an issue
  ctx.pathFor(data.foo) // ["foo"]
  ctx.isDefined(data.foo) // data.foo != null
  ctx.get<T>("baz") // property from parse options: s.parse(input, { baz: any })

  // and a few overloads for ctx.issue(...)
  ctx.issue(() => "major issue") // function (eg ParaglideJS - m.major_issue)
  ctx.issue(condition, "major issue") // raise issue only if condition is true
  ctx.issue("severe", "major issue") // issue with code & message
  ctx.issue("severe", "major issue", ["foo"]) // issue with code, message & path
})
```

## Types

Though it's very easy to [add types](./src/types.ts), the list of supported types is intentionally kept simple.

```ts
z.string()
z.string().optional() // string | undefined
z.string().nullable() // string | null
z.number()
z.boolean()
z.enum(["ordered", "shipped"])
z.enum(["ordered", "shipped"] as const) // as needed
z.file()
z.literal(...)
  z.literal(true)
  z.literal(1)
  z.literal("type")
z.record(z.number()) // { jan: 1, feb: 2 }
z.array(z.string())
z.array(z.string(), { coerce: true }) // parse("a") => [ "a" ]
z.object({
  name: z.string(),
  age: z.number(),
  interests: z.array(z.string())
})
z.union([
  z.object({
    success: z.literal(true),
    data: z.object({
      name: z.string(),
    }),
  }),
  z.object({
    success: z.literal(false),
    issues: z.array(
      z.object({
        code: z.string(),
        message: z.string(),
        path: z.array(z.number()),
      }),
    ),
  }),
]);
```

## Parse

As with zod, call parse or safeParse.

On error, pukka returns a list of issues, and also the input and issues for each field!

This makes it easy to render say a [Remix](https://remix.run/docs/en/main/guides/form-validation#step-3-displaying-validation-errors) form with field level errors.

### safeParse / safeParseAsync

```ts
const { success, data, issues, input } = Register.safeParse({
  password: "secret",
});

if (success) {
  data.email;
} else {
  issues;
  input.email.value;
  input.email.issues;
}
```

### parse / parseAsync

```ts
try {
  const data = Register.parse({ password: "secret" });
} catch (e) {
  if (e instanceof ParseError) {
    e.issues;
    e.input(Register);
  }
}
```

### issues

```ts
issues = [
  { path: ["email"], code: "required", message: "Value is required" },
  { path: ["email"], code: "custom", message: "Please enter your email", },
  { path: ["password"], code: "custom", message: "Password should be 8 or more characters", },
  { path: ["confirm"], code: "required", message: "Value is required", },
  { path: ["confirm"], code: "custom", message: "Passwords don't match", },
];
```

### input

Field level issues and values, to easily render forms.

```ts
input = {
  email: {
    issues: [
      { code: "required", message: "Value is required", },
      { code: "custom", message: "Please enter your email", },
    ],
  },
  password: {
    parsed: "secret",
    value: "secret",
    issues: [
      { code: "custom", message: "Password should be 8 or more characters", },
    ],
  },
  confirm: {
    issues: [
      { code: "required", message: "Value is required", },
      { code: "custom", message: "Passwords don't match", },
    ],
  },
  issues: [],
};
```

## Partial validation 

With pukka, you don't need to run the whole validation suite to validate a field on change.

```ts
const handleEmailChange = (e) => {
  const { issues } = Register.properties.email.safeParse(e.target.value);
};

// or if the schema is unknown (a generic ui form library)

import { getPathType } from "pukka";

const handleEmailChange = (e) => {
  const email = getPathType(schema, ["email"]);
  const { issues } = email.safeParse(e.target.value);
};
```

## Infer

Typescript first - pukka!

```ts
type Register = z.infer<typeof Register>

/*
type Register = {
  email: string;
  password: string;
  confirm: string;
}
*/
```

## Built-in validators

Sorry, none.

Because [validator.js](https://github.com/validatorjs/validator.js) probably has more than what we ever need.

```ts
import isEmail from "validator/lib/isEmail";

isEmail(data.email) || ctx.issue("That's not a valid email");
```

## Runtime context

pukka supports passing additional context to parse for complex validations.

For example, to check if an email is already registered

1. On the browser, hit an API endpoint
2. On the server, use [drizzle](https://orm.drizzle.team/) to query the users table

The same static pukka schema works for both!

```ts
type IsEmailRegistered = (email: string) => Promise<boolean>;

const Register = z
  .object({
    email: z.string(),
    password: z.string(),
    confirm: z.string(),
  })
  .refineAsync((ctx, data) => {
    if (data.email.length) {
      const isEmailRegistered = ctx.get<IsEmailRegistered>("isEmailRegistered");

      if (await isEmailRegistered(data.email)) {
        ctx.issue("Email is already registered");
      }
    }
  });
```

On the browser

```ts
const result = Register.safeParse(input, {
  isEmailRegistered: (email: string) => fetch(`/email/check?${email}`).then(...)
});
```

And on the server

```ts
const result = Register.safeParse(data, {
  isEmailRegistered: (email: string) => db.select().from(users).where(...)
});
```

## Error customization

pukka has excellent support for error message customization and internationalization.

In fact it was kind of born from a [long running issue](https://github.com/colinhacks/zod/issues/2940) in zod.

It also plays real nice with [ParaglideJS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) i18n.

The core issues *invalid_type_error, required_error* can be overriden at a field level.

```ts
const Register = z.object({
  email: z.string({ required_error: "Please enter your email" }),
  password: z.string({ required_error: m.password_required }), // ParaglideJS
})
```

For schemas, instead of hardcoding errors, register the issues.

```ts
const REGISTRATION_ISSUES = registerIssues({
  email_required: () => "Please enter your email",
  password_length: (length: number) => `Password should be ${length} or more characters`,
  password_mismatch: () => "Passwords don't match",
});

const m = REGISTRATION_ISSUES;

const Register = z
  .object({
    email: z.string(),
    password: z.string(),
    confirm: z.string(),
  })
  .refine((ctx, data) => {
    data.email.length > 0 || ctx.issue(m.email_required());
    data.password.length >= 8 || ctx.issue(m.password_length(8));
    data.password !== data.confirm && ctx.issue(m.password_mismatch());
  });
```

Customize (pardon the Spanish)

```ts
REGISTRATION_ISSUES.customize({
  email_required: () => "Por favor ingrese su correo electrónico",
  password_length: (length) => `La contraseña debe tener ${length} caracteres o más.`,
  password_mismatch: () => "Las contraseñas no coinciden",
});
```

You can also customize the three built-in core issues

```ts
import { CORE_ISSUES } from "pukka";

CORE_ISSUES.customize({
  invalid_type: (expected: string, input: unknown, path: Path) => "...",
  required: (input: undefined | null, path: Path) => "...",
  exception: (e: Error, path: Path) => "..."
});
```

## Type coercion and sanitization

The following options can be passed to parse and can be overriden per schema

```ts
type ParseOptions = {
  string?: {
    coerce?: boolean; // anything other than objects & arrays to string
    trim?: boolean; // strings are trimmed by default, override it here
    empty?: boolean; // if false, empty strings result in a required error
  };
  number?: {
    coerce?: boolean; // string to number
  };
  boolean?: {
    coerce?: boolean; // truthy
  };
};

const schema = z.object({
  name: z.string({ trim: true }),
  interests: z.array(z.string(), { coerce: true })
})

schema.parse({
  string: { coerce: true, trim: false, empty: false },
  number: { coerce: true },
  boolean: { coerce: true }
})
```

## Helpers

### DeepObject.fromEntries(FormData | URLSearchParams)

Parse a deeply nested [qs](https://www.npmjs.com/package/qs) encoded form.

```ts
const form = new FormData();

form.append("addresses[0].state", "TX");
form.append("addresses[1].state", "CA");

const data = DeepObject.fromEntries(form);

data = { addresses: [{ state: "TX" }, { state: "CA" }] };
```

### toParsedInput(data: unknown)

Convert valid data to parsed input, useful when rendering forms.

```ts
const data = toParsedInput({
  name: "pukka",
});

data = {
  name: { parsed: "pukka", value: "pukka", issues: [], },
  issues: [],
};
```

### getDisplayName(path: (string|number)[])

Gets the display name for a path.

```ts
const label = getDisplayName(["orders", 0, "orderNumber"])
label = "Order Number"
```

## Extensibility

pukka is designed to be extensible!

### Adding a new type

It's very simple to add new [types](./src/types.ts) to pukka.

To add an email type, extend from StringType and override check and coerce methods. 

```ts
import { type ParseContext, types } from "pukka";

import isEmail from "validator/lib/isEmail";

export class EmailType extends types.StringType {
  protected override check(ctx: ParseContext, input: unknown) {
    const res = super.check(ctx, input);
    return res !== true
      ? res
      : isEmail(input as string) || ctx.issue("Invalid email");
  }
  protected override coerce(ctx: ParseContext, input: unknown) {
    // doesn't make sense to coerce anything to email
    return undefined;
  }
}
```

### Adding schema extensions

The following adds some extension to the StringType.

An extension method takes one or more parameters and returns a refinement.

```ts
import { Extensions } from "pukka";

const StringExtensions1 = Extensions.for(types.StringType, {
  min: (length: number) => (ctx, data) =>
    data.length >= length ||
    ctx.issue(`Value must be at least ${length} characters`),
  max: ...,
});

// or async - say check username availability
const StringExtensions2 = Extensions.forAsync(types.StringType, {
  username: () => async (ctx, data) => ...
});
```

### Register and use the new type and extension

```ts

import { Extensions, registerType, z as zee } from "pukka";

// combine extensions for a type
const StringExtensions = {
  ...StringExtensions1,
  ...StringExtensions2,
};

// and apply
const extendedString = Extensions.apply(types.StringType, StringExtensions);

export const z = {
  ...zee,
  email: registerType(EmailType),
  string: extendedString(zee.string),
};

const Register = z
  .object({
    email: z.email(),
    password: z.string().min(8),
    confirm: z.string(),
  })
  .refine((ctx, data) => {
    if (ctx.isDefined(data.confirm) && data.password !== data.confirm) {
      ctx.issue("Passwords don't match");
    }
  });
```

### Extension introspection

The parameters passed to an extension can be retrieved in a typesafe manner.

This allows extension authors to easily implement say a `pukka-openapi` library.

```ts

import { Extensions } from "pukka";

const min = Extensions.getParams(
  Register.properties.password,
  StringExtensions,
  "min",
); // [length: number]
```

## Gotchas

### Checking for null input

pukka guarantees that the data passed to refine won't have null or undefined fields.

So `data.field != null` won't work as expected.

Whether input data was actually null can be checked with *ctx.isDefined()*

```ts
if (ctx.isDefined(data.password) && data.password.length < 8) {
  ctx.issue("Password should be 8 or more characters");
}
```

### Destructuring

Rule of thumb - try to avoid!

pukka tracks property access using a proxy, and assigns *ctx.issue()* to the last accessed field.

So destructuring scalars won't work as expected.

```ts
schema.refine((ctx, data) => {
  const { email, password } = data;
  ctx.issue(email.length === 0, "Please enter your email") // won't work
  ctx.issue(data.email.length === 0, "Please enter your email") // works
})
```

### Extensions and optional/nullable

Optional and nullable need to be specified last with extensions.

```ts
z.string().min(2).optional() // correct: string | undefined
z.string().optional().min(2) // incorrect: string
```

## Inspiration (prior art)

[zod](https://valibot.dev/) - obviously, and [valibot](https://valibot.dev/).

pukka favors simplicity over feature bloat.

That is, no lazy recursive types, intersection types, function types, pick, merge, input vs output schemas, pipes, preprocess, transform etc.

If all you want to do is validate forms and api payloads in a natural, typesafe way, do give pukka a try.

I am sure you'll love it - it's a lot of goodness packed in a tiny extensible codebase!
