declare const jest: {
  fn: () => unknown;
  mock: (name: string, factory: () => unknown) => void;
};
declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;
declare function expect<T>(actual: T): {
  toBe(expected: T): void;
  toEqual(expected: unknown): void;
};
