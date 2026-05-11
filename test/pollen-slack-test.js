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

const buildOpenMeteoNoData = (latitude, longitude) => ({
  latitude,
  longitude,
  hourly: {
    alder_pollen: [null],
    birch_pollen: [null],
    grass_pollen: [null],
    mugwort_pollen: [null],
    olive_pollen: [null],
    ragweed_pollen: [null],
  },
});

const mockOpenMeteoGeocode = (name, result) => nock('https://geocoding-api.open-meteo.com')
  .get('/v1/search')
  .query((query) => query.name === `${name}`)
  .reply(200, { results: [result] });

const mockOpenMeteoAirQuality = (latitude, longitude, body) => nock('https://air-quality-api.open-meteo.com')
  .get('/v1/air-quality')
  .query((query) => Number(query.latitude) === latitude && Number(query.longitude) === longitude)
  .reply(200, body);

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
    mockOpenMeteoGeocode('37206', {
      name: 'Nashville',
      latitude: 36.17,
      longitude: -86.78,
      postcodes: ['37206'],
      country_code: 'US',
      admin1: 'TN',
    });
    mockOpenMeteoAirQuality(36.17, -86.78, buildOpenMeteoNoData(36.17, -86.78));

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
    mockOpenMeteoGeocode('90210', {
      name: 'Beverly Hills',
      latitude: 34.09,
      longitude: -118.41,
      postcodes: ['90210'],
      country_code: 'US',
      admin1: 'CA',
    });
    mockOpenMeteoAirQuality(34.09, -118.41, buildOpenMeteoNoData(34.09, -118.41));

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
    mockOpenMeteoGeocode('99501', {
      name: 'Anchorage',
      latitude: 61.2,
      longitude: -149.9,
      postcodes: ['99501'],
      country_code: 'US',
      admin1: 'AK',
    });
    mockOpenMeteoAirQuality(61.2, -149.9, buildOpenMeteoNoData(61.2, -149.9));

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

  it('responds with a Slack payload from Open-Meteo when pollen data is available', function (done) {
    mockOpenMeteoGeocode('London', {
      name: 'London',
      latitude: 51.5,
      longitude: -0.1,
      country_code: 'GB',
    });
    mockOpenMeteoAirQuality(51.5, -0.1, {
      latitude: 51.5,
      longitude: -0.1,
      hourly: {
        alder_pollen: [0.0, 0.0],
        birch_pollen: [0.1, 0.6],
        grass_pollen: [1.2, 1.7],
        mugwort_pollen: [0.0, 0.0],
        olive_pollen: [0.0, 0.0],
        ragweed_pollen: [0.0, 0.0],
      },
    });

    const selfRoom = this.room;
    selfRoom.user.say('alice', '@hubot pollen London');
    setTimeout(
      () => {
        try {
          assert.strictEqual(selfRoom.messages[0][0], 'alice');
          assert.strictEqual(selfRoom.messages[0][1], '@hubot pollen London');

          const message = selfRoom.messages[1][1];
          assert.strictEqual(selfRoom.messages[1][0], 'hubot');
          assert(Array.isArray(message.attachments), 'Expected Slack attachments payload');
          assert.strictEqual(message.attachments.length, 1);

          const attachment = message.attachments[0];
          assert.strictEqual(attachment.author_name, 'Open-Meteo');
          assert.strictEqual(attachment.author_link, 'https://open-meteo.com/');
          assert.strictEqual(attachment.color, 'warning');
          assert.strictEqual(attachment.title, 'London, GB Pollen');
          assert.strictEqual(attachment.title_link, 'https://open-meteo.com/en/docs/air-quality-api');
          assert.strictEqual(
            attachment.fallback,
            'London, GB Pollen: Low intensity (1.7 grains/m^3 peak) - Grass 1.7, Birch 0.6',
          );
          assert.strictEqual(attachment.footer, 'Data: Open-Meteo');
          assert.strictEqual(typeof attachment.ts, 'number');

          assert.deepStrictEqual(attachment.fields, [
            {
              title: 'Intensity',
              value: 'Low (Open-Meteo model scale)',
              short: true,
            },
            {
              title: 'Peak',
              value: '1.7 grains/m^3',
              short: true,
            },
            {
              title: 'Types',
              value: 'Grass 1.7, Birch 0.6',
              short: false,
            },
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
