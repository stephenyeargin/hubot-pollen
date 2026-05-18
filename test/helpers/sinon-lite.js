const createSpyLike = (fn = () => {}) => {
  const spy = (...args) => {
    spy.calls.push(args);
    return fn(...args);
  };

  spy.calls = [];

  Object.defineProperty(spy, 'called', {
    get() {
      return spy.calls.length > 0;
    },
  });

  Object.defineProperty(spy, 'calledTwice', {
    get() {
      return spy.calls.length === 2;
    },
  });

  Object.defineProperty(spy, 'firstCall', {
    get() {
      return { args: spy.calls[0] || [] };
    },
  });

  spy.calledWith = (...expectedArgs) => spy.calls.some((actualArgs) => expectedArgs.every((expectedArg, index) => {
    const actualArg = actualArgs[index];

    if (expectedArg && typeof expectedArg.test === 'function') {
      return expectedArg.test(actualArg);
    }

    return actualArg === expectedArg;
  }));

  return spy;
};

const stub = (target, method) => {
  if (!target || !method) {
    return createSpyLike();
  }

  const original = target[method];
  const replacement = createSpyLike();

  replacement.restore = () => {
    target[method] = original;
  };

  target[method] = replacement;

  return replacement;
};

const spy = (fn) => createSpyLike(fn);

const match = (matcher) => ({
  test(value) {
    if (matcher instanceof RegExp) {
      return matcher.test(String(value));
    }

    if (typeof matcher === 'function') {
      return matcher(value);
    }

    return value === matcher;
  },
});

module.exports = {
  stub,
  spy,
  match,
};
