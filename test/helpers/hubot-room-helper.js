const http = require('http');
const https = require('https');

const createHttpClient = (requestUrl) => {
  const state = {
    headers: {},
  };

  const client = {
    timeout() {
      return client;
    },

    headers(headers) {
      Object.assign(state.headers, headers);
      return client;
    },

    header(name, value) {
      state.headers[name] = value;
      return client;
    },

    get() {
      return (callback) => {
        const url = new globalThis.URL(requestUrl);
        const transport = url.protocol === 'https:' ? https : http;
        const options = {
          method: 'GET',
          headers: state.headers,
        };

        const req = transport.request(url, options, (res) => {
          let body = '';

          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            body += chunk;
          });

          res.on('end', () => {
            callback(null, { statusCode: res.statusCode }, body);
          });
        });

        req.on('error', (err) => callback(err));
        req.end();
      };
    },
  };

  return client;
};

class Helper {
  constructor(scriptPaths) {
    this.scriptPaths = scriptPaths;
  }

  createRoom() {
    const listeners = [];
    const messages = [];

    const robot = {
      adapterName: 'shell',
      respond(regex, handler) {
        listeners.push({ regex, handler });
      },
      http: createHttpClient,
      logger: {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      },
    };

    this.scriptPaths.forEach((scriptPath) => {
      const resolved = require.resolve(scriptPath);
      delete require.cache[resolved];
      const register = require(resolved);
      register(robot);
    });

    const room = {
      robot,
      messages,
      user: {
        say: (user, text) => {
          messages.push([user, text]);
          const command = String(text).replace(/^@hubot\s+/i, '').replace(/^hubot\s+/i, '');

          listeners.forEach(({ regex, handler }) => {
            const match = command.match(regex);
            if (!match) {
              return;
            }

            const msg = {
              match,
              send: (payload) => {
                messages.push(['hubot', payload]);
              },
            };

            handler(msg);
          });
        },
      },
      destroy: () => {
        listeners.length = 0;
      },
    };

    return room;
  }
}

module.exports = Helper;
