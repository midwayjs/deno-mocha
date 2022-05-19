const childProcess = require('child_process');
const assert = require('assert');
const path = require('path');
const pkg = require('../package.json');

const bin = path.resolve(__dirname, '../', pkg.bin);

async function run(args) {
  const cp = childProcess.spawn(process.execPath, [bin, ...args], {
    stdio: 'pipe',
  });

  const output = {
    stdout: [],
    stderr: [],
  };
  for (const type of Object.keys(output)) {
    cp[type].pipe(process[type]);
    cp[type].on('data', chunk => {
      output[type].push(chunk);
    });
  }

  return new Promise((resolve, reject) => {
    cp.on('exit', (code, signal) => {
      if (code === 0) {
        const texts = {
          stdout: [],
          stderr: [],
        };
        for (const type of Object.keys(output)) {
          texts[type] = Buffer.concat(output[type]).toString('utf8');
        }
        return resolve(texts);
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

  it('should exclude tests', async () => {
    await run(['--exclude', 'test/integration/exclude/foo', 'test/integration/exclude/**/*.test.ts']);
  });

  it('should print help', async () => {
    const out = await run(['--help']);
    assert.match(out.stdout, /deno-mocha \[options\]/);
  });
});
