/**
 * Typed mapping between a state object and URL search parameters. Knows nothing about
 * any particular screen: each list screen declares its own schema with `param.*` fields.
 *
 * Values equal to their default are omitted from the URL, so URLs stay short and a
 * default can change without breaking shared links. Unknown or invalid values fall back to
 * the default on parse rather than throwing.
 */
export interface ParamField<V> {
  default: V;
  /** All values for this key, in URL order. Empty when absent. */
  parse(values: string[]): V;
  serialise(value: V): string[];
}

export interface ParamsCodec<T extends object> {
  readonly defaults: T;
  parse(params: URLSearchParams): T;
  /** Writes `state` into a copy of `params`, leaving parameters it does not own untouched. */
  apply(params: URLSearchParams, state: T): URLSearchParams;
  toSearchString(state: T): string;
  /** Keys whose serialised value differs between the two states. */
  changedKeys(a: T, b: T): Array<keyof T>;
}

export function createParamsCodec<T extends object>(schema: {
  [K in keyof T]-?: ParamField<T[K]>;
}): ParamsCodec<T> {
  const keys = Object.keys(schema) as Array<keyof T & string>;
  const fieldOf = <K extends keyof T & string>(key: K): ParamField<T[K]> => schema[key];
  const serialiseKey = <K extends keyof T & string>(key: K, value: T[K]) =>
    fieldOf(key).serialise(value);

  const defaults = Object.fromEntries(keys.map((key) => [key, fieldOf(key).default])) as T;

  function parse(params: URLSearchParams): T {
    const state = {} as T;
    for (const key of keys) state[key] = fieldOf(key).parse(params.getAll(key));
    return state;
  }

  function apply(params: URLSearchParams, state: T): URLSearchParams {
    const next = new URLSearchParams(params);
    for (const key of keys) {
      next.delete(key);
      const values = serialiseKey(key, state[key]);
      const defaultValues = serialiseKey(key, defaults[key]);
      if (!sameValues(values, defaultValues)) {
        for (const value of values) next.append(key, value);
      }
    }
    return next;
  }

  return {
    defaults,
    parse,
    apply,
    toSearchString: (state) => apply(new URLSearchParams(), state).toString(),
    changedKeys: (a, b) =>
      keys.filter((key) => !sameValues(serialiseKey(key, a[key]), serialiseKey(key, b[key]))),
  };
}

function sameValues(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

const INTEGER = /^\d+$/;

function parseInteger(values: string[]): number | undefined {
  const raw = values[0];
  return raw !== undefined && INTEGER.test(raw) ? Number(raw) : undefined;
}

export const param = {
  string: (defaultValue = ''): ParamField<string> => ({
    default: defaultValue,
    parse: (values) => values[0] ?? defaultValue,
    serialise: (value) => (value === '' ? [] : [value]),
  }),

  /** Repeated parameter (`a=1&a=2`). Order is preserved; duplicates are dropped. */
  stringList: (): ParamField<string[]> => ({
    default: [],
    parse: (values) => [...new Set(values.filter((value) => value !== ''))],
    serialise: (value) => value,
  }),

  /** Optional non-negative integer. */
  int: (): ParamField<number | undefined> => ({
    default: undefined,
    parse: parseInteger,
    serialise: (value) => (value === undefined ? [] : [String(value)]),
  }),

  /** Integer of at least 1, such as a page number. */
  positiveInt: (defaultValue: number): ParamField<number> => ({
    default: defaultValue,
    parse: (values) => {
      const parsed = parseInteger(values);
      return parsed !== undefined && parsed >= 1 ? parsed : defaultValue;
    },
    serialise: (value) => [String(value)],
  }),

  oneOf: <const O extends readonly string[]>(
    options: O,
    defaultValue: O[number],
  ): ParamField<O[number]> => ({
    default: defaultValue,
    parse: (values) => options.find((option) => option === values[0]) ?? defaultValue,
    serialise: (value) => [value],
  }),

  /** Like `oneOf`, but absence is meaningful (`undefined`) rather than a concrete default. */
  oneOfOptional: <const O extends readonly string[]>(
    options: O,
  ): ParamField<O[number] | undefined> => ({
    default: undefined,
    parse: (values) => options.find((option) => option === values[0]),
    serialise: (value) => (value === undefined ? [] : [value]),
  }),
};
