const fs = require('fs');
const path = require('path');

const rootSuite = {
  name: 'root',
  suites: [],
  tests: [],
  beforeHooks: [],
  beforeEachHooks: [],
  afterEachHooks: [],
};

const suiteStack = [rootSuite];

const currentSuite = () => suiteStack[suiteStack.length - 1];

global.describe = (name, fn) => {
  const suite = {
    name,
    suites: [],
    tests: [],
    beforeHooks: [],
    beforeEachHooks: [],
    afterEachHooks: [],
  };

  currentSuite().suites.push(suite);
  suiteStack.push(suite);
  fn();
  suiteStack.pop();
};

global.it = (name, fn) => {
  currentSuite().tests.push({ name, fn });
};

global.before = (fn) => {
  currentSuite().beforeHooks.push(fn);
};

global.beforeEach = (fn) => {
  currentSuite().beforeEachHooks.push(fn);
};

global.afterEach = (fn) => {
  currentSuite().afterEachHooks.push(fn);
};

const runFunction = (fn, context) => {
  if (typeof fn !== 'function') {
    return Promise.resolve();
  }

  if (fn.length > 0) {
    return new Promise((resolve, reject) => {
      const done = (err) => {
        if (err) {
          reject(err);
          return;
        }

        resolve();
      };

      try {
        fn.call(context, done);
      } catch (err) {
        reject(err);
      }
    });
  }

  return Promise.resolve(fn.call(context));
};

const flattenSuites = (suite, parents = []) => {
  const lineage = [...parents, suite];
  const cases = suite.tests.map((test) => ({ lineage, test }));

  suite.suites.forEach((child) => {
    cases.push(...flattenSuites(child, lineage));
  });

  return cases;
};

const collectTestFiles = (dirPath) => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  entries.forEach((entry) => {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(fullPath));
      return;
    }

    if (entry.isFile() && entry.name.endsWith('-test.js')) {
      files.push(fullPath);
    }
  });

  return files;
};

const run = async () => {
  const testFiles = collectTestFiles(path.resolve(__dirname)).sort();
  testFiles.forEach((filePath) => {
    require(filePath);
  });

  const cases = flattenSuites(rootSuite).filter((row) => row.lineage.length > 1);
  const suiteSet = new Set();

  let passed = 0;
  let failed = 0;

  for (const row of cases) {
    const { lineage, test } = row;
    const displaySuite = lineage.slice(1).map((suite) => suite.name).join(' > ');
    const testName = `${displaySuite}: ${test.name}`;
    const context = {};

    try {
      for (let i = 1; i < lineage.length; i += 1) {
        const suite = lineage[i];
        if (!suiteSet.has(suite)) {
          suiteSet.add(suite);
          for (const hook of suite.beforeHooks) {
            // before hooks run with a suite-local context.
            // They are not using shared "this" in this repository.
            // Keeping this as an empty object mirrors current usage.
            await runFunction(hook, {});
          }
        }
      }

      const beforeEachHooks = lineage.slice(1).flatMap((suite) => suite.beforeEachHooks);
      const afterEachHooks = lineage.slice(1).flatMap((suite) => suite.afterEachHooks).reverse();

      for (const hook of beforeEachHooks) {
        await runFunction(hook, context);
      }

      await runFunction(test.fn, context);

      for (const hook of afterEachHooks) {
        await runFunction(hook, context);
      }

      passed += 1;
      console.log(`ok - ${testName}`);
    } catch (err) {
      failed += 1;
      console.error(`not ok - ${testName}`);
      console.error(err && err.stack ? err.stack : err);

      try {
        const afterEachHooks = lineage.slice(1).flatMap((suite) => suite.afterEachHooks).reverse();
        for (const hook of afterEachHooks) {
          await runFunction(hook, context);
        }
      } catch {
        // Ignore teardown errors after a failed test.
      }
    }
  }

  const total = passed + failed;
  console.log(`\n${passed}/${total} passing`);

  if (failed > 0) {
    process.exitCode = 1;
  }
};

run().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
