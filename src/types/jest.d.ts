// Minimal Jest globals for tests before installing @types/jest
declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: (() => void) | (() => Promise<void>)): void;
declare function beforeAll(fn: (() => void) | (() => Promise<void>)): void;
declare function afterAll(fn: (() => void) | (() => Promise<void>)): void;

declare function expect(actual: any): {
  toBe(expected: any): void;
  toHaveProperty(prop: string, value?: any): void;
  toEqual(expected: any): void;
};
