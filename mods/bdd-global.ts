import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe as denoDescribe,
  it as denoIt,
} from 'https://deno.land/std@{{stdVersion}}/testing/bdd.ts';

const sanitizeOps = `{{sanitizeOps}}` === ('true') as string;
const sanitizeResources = `{{sanitizeResources}}` === ('true') as string;

function createDescribe(realDescribe) {
  function describe(name, fn) {
    realDescribe({
      name,
      sanitizeOps,
      sanitizeResources,
    }, fn);
  }
  return describe as any;
}
const describe = createDescribe(denoDescribe);
describe.skip = createDescribe(denoDescribe.ignore);
describe.only = createDescribe(denoDescribe.only);

function createIt(realIt) {
  function it(name, fn) {
    if (fn.length === 0) {
      return realIt({
        name,
        sanitizeOps,
        sanitizeResources,
      }, fn);
    }

    realIt({
      name,
      sanitizeOps,
      sanitizeResources,
    }, () => {
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

  return it as any;
}
const it = createIt(denoIt);
it.skip = createIt(denoIt.ignore);
it.only = createIt(denoIt.only);

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
