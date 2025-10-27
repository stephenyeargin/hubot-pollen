/* global describe beforeEach afterEach it */
/* eslint-disable func-names */
const Helper = require('hubot-test-helper');
const assert = require('assert');
const nock = require('nock');
const sinon = require('sinon');

const helper = new Helper([
  'adapters/slack.js',
  '../src/pollen.js',
]);

describe('hubot-pollen with slack adapter', () => {
  beforeEach(function () {
    process.env.HUBOT_LOG_LEVEL = 'error';
    process.env.HUBOT_POLLEN_ZIP = 37206;
    nock.disableNetConnect();

    // Mock console methods to suppress output
    this.consoleStubs = {
      log: sinon.stub(console, 'log'),
      error: sinon.stub(console, 'error'),
      warn: sinon.stub(console, 'warn'),
      debug: sinon.stub(console, 'debug'),
      info: sinon.stub(console, 'info'),
    };

    this.room = helper.createRoom();
  });

  afterEach(function () {
    delete process.env.HUBOT_LOG_LEVEL;
    delete process.env.HUBOT_POLLEN_ZIP;
    nock.cleanAll();

    // Restore console methods
    Object.values(this.consoleStubs).forEach((stub) => stub.restore());

    this.room.destroy();
  });

  it('responds to pollen forecast for default location', function (done) {
    nock('https://www.pollen.com')
      .get('/api/forecast/current/pollen/37206')
      .matchHeader('User-Agent', /Mozilla\/.*/)
      .matchHeader('Referer', 'https://www.pollen.com/forecast/current/pollen/37206')
      .replyWithFile(200, `${__dirname}/fixtures/37206.json`);

    const selfRoom = this.room;
    selfRoom.user.say('alice', '@hubot pollen');
    setTimeout(
      () => {
        try {
          assert.deepStrictEqual(selfRoom.messages, [
            ['alice', '@hubot pollen'],
            [
              'hubot',
              {
                attachments: [
                  {
                    author_icon: 'https://www.pollen.com/Content/favicon/apple-touch-icon-72x72.png',
                    author_link: 'https://www.pollen.com/',
                    author_name: 'Pollen.com',
                    color: 'danger',
                    fallback: 'Nashville, TN Pollen: 8.2 (Medium-High) - Alder, Juniper, Maple',
                    fields: [
                      {
                        short: true,
                        title: 'Level',
                        value: 'Medium-High',
                      },
                      {
                        short: true,
                        title: 'Count',
                        value: '8.2',
                      },
                      {
                        short: false,
                        title: 'Types',
                        value: 'Alder, Juniper, Maple',
                      },
                    ],
                    footer: 'Pollen.com',
                    title: 'Nashville, TN Pollen',
                    title_link: 'https://www.pollen.com/forecast/current/pollen/37206',
                    ts: 1520827200,
                  },
                ],
              },

            ],
          ]);
          done();
        } catch (err) {
          done(err);
        }
      },
      100,
    );
  });

  it('responds to pollen forecast plus a zip code', function (done) {
    nock('https://www.pollen.com')
      .get('/api/forecast/current/pollen/90210')
      .matchHeader('User-Agent', /Mozilla\/.*/)
      .matchHeader('Referer', 'https://www.pollen.com/forecast/current/pollen/90210')
      .replyWithFile(200, `${__dirname}/fixtures/90210.json`);

    const selfRoom = this.room;
    selfRoom.user.say('alice', '@hubot pollen 90210');
    setTimeout(
      () => {
        try {
          assert.deepStrictEqual(selfRoom.messages, [
            ['alice', '@hubot pollen 90210'],
            [
              'hubot',
              {
                attachments: [
                  {
                    author_icon: 'https://www.pollen.com/Content/favicon/apple-touch-icon-72x72.png',
                    author_link: 'https://www.pollen.com/',
                    author_name: 'Pollen.com',
                    color: 'warning',
                    fallback: 'Beverly Hills, CA Pollen: 7.2 (Medium) - Alder, Juniper, Ash',
                    fields: [
                      {
                        short: true,
                        title: 'Level',
                        value: 'Medium',
                      },
                      {
                        short: true,
                        title: 'Count',
                        value: '7.2',
                      },
                      {
                        short: false,
                        title: 'Types',
                        value: 'Alder, Juniper, Ash',
                      },
                    ],
                    footer: 'Pollen.com',
                    title: 'Beverly Hills, CA Pollen',
                    title_link: 'https://www.pollen.com/forecast/current/pollen/90210',
                    ts: 1520827200,
                  },
                ],
              },
            ],
          ]);
          done();
        } catch (err) {
          done(err);
        }
      },
      100,
    );
  });

  it('responds to pollen forecast for a zip code with no results', function (done) {
    nock('https://www.pollen.com')
      .get('/api/forecast/current/pollen/99501')
      .matchHeader('User-Agent', /Mozilla\/.*/)
      .matchHeader('Referer', 'https://www.pollen.com/forecast/current/pollen/99501')
      .replyWithFile(200, `${__dirname}/fixtures/99501.json`);

    const selfRoom = this.room;
    selfRoom.user.say('alice', '@hubot pollen 99501');
    setTimeout(
      () => {
        try {
          assert.deepStrictEqual(selfRoom.messages, [
            ['alice', '@hubot pollen 99501'],
            ['hubot', '99501 Pollen: No forecast available.'],
          ]);
          done();
        } catch (err) {
          done(err);
        }
      },
      100,
    );
  });
});
