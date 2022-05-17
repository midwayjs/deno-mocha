import {
  beforeAll,
  afterAll,
  afterEach,
  beforeEach,
  describe,
  it,
} from "https://deno.land/std@0.139.0/testing/bdd.ts";

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
