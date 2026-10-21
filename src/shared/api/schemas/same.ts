/**
 * `Same<A, B>` is `true` when each type is assignable to the other, and `false` when they differ.
 * `Assert<Same<...>>` fails to compile on `false`. A schema file ends with a tuple of these, so a
 * schema that drifts from its TypeScript interface (or the reverse) is a compile error, not a
 * surprise in production.
 */
export type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export type Assert<T extends true> = T;
