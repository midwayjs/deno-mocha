const childProcess = require('child_process');
const assert = require('assert');
const path = require('path');
const pkg = require('../package.json');

const bin = path.resolve(__dirname, '../', pkg.bin);

async function run(patterns) {
  const cp = childProcess.spawn(process.execPath, [bin, ...patterns], {
    stdio: 'inherit',
  });
  return new Promise((resolve, reject) => {
    cp.on('exit', (code, signal) => {
      if (code === 0) {
        return resolve();
      }
      reject(new Error(`test failed: code(${code}), signal(${signal})`));
    });
  });
}

describe('deno-mocha-runner', function () {
  this.timeout(60_000);
  it('should run test', async () => {
    await run(['test/integration/success/*.test.ts']);
  });

  it('should fail test', async () => {
    await assert.rejects(run(['test/integration/failures/*.test.ts']), /test failed: code\(1\)/)
  });
});
