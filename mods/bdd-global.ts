import {
  beforeAll,
  afterAll,
  afterEach,
  beforeEach,
  describe,
  it as denoIt,
} from "https://deno.land/std@{{stdVersion}}/testing/bdd.ts";

describe.skip = describe.ignore;

function it(title, fn) {
  if (fn.length === 0) {
    return denoIt(title, fn);
  }

  denoIt(title, async () => {
    return new Promise<void>((resolve, reject) => {
      fn((err) => {
        if (err) {
          return reject(err);
        }
        return resolve();
      });
    });
  });
}
it.skip = denoIt.ignore;
it.only = denoIt.only;

Object.assign(globalThis, {
  beforeAll,
  before: beforeAll,
  afterAll,
  after: afterAll,
  afterEach,
  beforeEach,
  describe,
  it,
});
