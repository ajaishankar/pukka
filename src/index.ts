export * from "./base";
export * from "./context";
export * from "./issue";
export * from "./util";
export * from "./extend";

export * as x from "./internal";
export * as types from "./types";

import type { Infer } from "./base";
import { pukka } from "./pukka";

export const z = pukka;
export namespace z {
  export type infer<T> = Infer<T>;
}
