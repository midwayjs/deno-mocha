import * as assert from 'assert';

describe.only('foo', () => {
  it.only('bar', () => {
    assert.deepStrictEqual({}, {});
  });

  it('should be skipped', () => {
    assert.ok(false);
  });
});

describe('should be skipped', () => {
  it('should be skipped', () => {
    assert.ok(false);
  });
});
