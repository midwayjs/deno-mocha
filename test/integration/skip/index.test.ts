import * as assert from 'assert';

describe('foo', () => {
  it('bar', () => {
    assert.deepStrictEqual({}, {});
  });

  it.skip('should be skipped', () => {
    assert.ok(false);
  });
});

describe.skip('should be skipped', () => {
  it('bar', () => {
    assert.ok(false);
  });
});
