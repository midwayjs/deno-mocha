describe('foo', () => {
  it('leaking test', () => {
    // assume this timer never ends.
    setTimeout(() => {}, 100_000_000);
  });
});
