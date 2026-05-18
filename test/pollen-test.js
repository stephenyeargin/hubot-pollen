const Helper = require('./helpers/hubot-room-helper');
const assert = require('assert');
const nock = require('nock');
const sinon = require('./helpers/sinon-lite');

const helper = new Helper([
  `${__dirname}/../src/pollen.js`,
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

const mockOpenMeteoGeocodeQuery = (queryMatcher, body) => nock('https://geocoding-api.open-meteo.com')
  .get('/v1/search')
  .query(queryMatcher)
  .reply(200, body);

const mockOpenMeteoAirQuality = (latitude, longitude, body) => nock('https://air-quality-api.open-meteo.com')
  .get('/v1/air-quality')
  .query((query) => Number(query.latitude) === latitude && Number(query.longitude) === longitude)
  .reply(200, body);

describe('hubot-pollen', () => {
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
            ['hubot', 'Nashville, TN Pollen: 8.2 (Medium-High) - Alder, Juniper, Maple'],
          ]);
          done();
        } catch (err) {
          done(err);
        }
      },
      100,
    );
  });

  it('responds to pollen forecast for default location with no allergens listed', function (done) {
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
      .replyWithFile(200, `${__dirname}/fixtures/37206-no-triggers.json`);

    const selfRoom = this.room;
    selfRoom.user.say('alice', '@hubot pollen');
    setTimeout(
      () => {
        try {
          assert.deepStrictEqual(selfRoom.messages, [
            ['alice', '@hubot pollen'],
            ['hubot', 'Nashville, TN Pollen: 0.1 (Low) - The pollen season in the area has completed.'],
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
            ['hubot', 'Beverly Hills, CA Pollen: 7.2 (Medium) - Alder, Juniper, Ash'],
          ]);
          done();
        } catch (err) {
          done(err);
        }
      },
      1000,
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

  it('handles a server error', function (done) {
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
      .reply(500);

    const selfRoom = this.room;
    const loggerErrorStub = sinon.stub(selfRoom.robot.logger, 'error');

    selfRoom.user.say('alice', '@hubot pollen');
    setTimeout(
      () => {
        try {
          assert.deepStrictEqual(selfRoom.messages, [
            ['alice', '@hubot pollen'],
            ['hubot', 'Error retrieving forecast: Server responded with HTTP 500'],
          ]);

          // Assert that the error was logged
          assert(loggerErrorStub.called, 'robot.logger.error should have been called');
          assert.strictEqual(
            loggerErrorStub.firstCall.args[0],
            'Server responded with HTTP 500',
            'Error message should match',
          );

          loggerErrorStub.restore();
          done();
        } catch (err) {
          loggerErrorStub.restore();
          done(err);
        }
      },
      100,
    );
  });

  it('responds from Open-Meteo when pollen data is available', function (done) {
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
          assert.deepStrictEqual(selfRoom.messages, [
            ['alice', '@hubot pollen London'],
            ['hubot', 'London, GB Pollen: Low intensity (1.7 grains/m^3 peak) - Grass 1.7, Birch 0.6'],
          ]);
          done();
        } catch (err) {
          done(err);
        }
      },
      100,
    );
  });

  it('augments non-zip geocoding terms before failing', function (done) {
    mockOpenMeteoGeocodeQuery(
      (query) => `${query.name}`.toLowerCase() === 'nashville, tn',
      { results: [] },
    );
    mockOpenMeteoGeocodeQuery(
      (query) => `${query.name}`.toLowerCase() === 'nashville tn',
      { results: [] },
    );
    mockOpenMeteoGeocodeQuery(
      (query) => `${query.name}`.toLowerCase() === 'nashville tn' && `${query.countryCode}`.toUpperCase() === 'US',
      { results: [] },
    );
    mockOpenMeteoGeocodeQuery(
      (query) => `${query.name}`.toLowerCase() === 'nashville tennessee' && `${query.countryCode}`.toUpperCase() === 'US',
      { results: [] },
    );
    mockOpenMeteoGeocodeQuery(
      (query) => `${query.name}`.toLowerCase() === 'nashville' && `${query.countryCode}`.toUpperCase() === 'US',
      {
        results: [
          {
            name: 'Nashville',
            latitude: 36.17,
            longitude: -86.78,
            postcodes: ['37206'],
            country_code: 'US',
            admin1: 'TN',
          },
        ],
      },
    );

    mockOpenMeteoAirQuality(36.17, -86.78, buildOpenMeteoNoData(36.17, -86.78));

    nock('https://www.pollen.com')
      .get('/api/forecast/current/pollen/37206')
      .matchHeader('User-Agent', /Mozilla\/.*/)
      .matchHeader('Referer', 'https://www.pollen.com/forecast/current/pollen/37206')
      .replyWithFile(200, `${__dirname}/fixtures/37206.json`);

    const selfRoom = this.room;
    selfRoom.user.say('alice', '@hubot pollen nashville, tn');
    setTimeout(
      () => {
        try {
          assert.deepStrictEqual(selfRoom.messages, [
            ['alice', '@hubot pollen nashville, tn'],
            ['hubot', 'Nashville, TN Pollen: 8.2 (Medium-High) - Alder, Juniper, Maple'],
          ]);
          done();
        } catch (err) {
          done(err);
        }
      },
      100,
    );
  });

  it('supports UK alias in geocoding augmentation', function (done) {
    mockOpenMeteoGeocodeQuery(
      (query) => `${query.name}`.toLowerCase() === 'london, uk',
      { results: [] },
    );
    mockOpenMeteoGeocodeQuery(
      (query) => `${query.name}`.toLowerCase() === 'london uk',
      { results: [] },
    );
    mockOpenMeteoGeocodeQuery(
      (query) => `${query.name}`.toLowerCase() === 'london gb' && `${query.countryCode}`.toUpperCase() === 'GB',
      {
        results: [
          {
            name: 'London',
            latitude: 51.5,
            longitude: -0.1,
            country_code: 'GB',
          },
        ],
      },
    );

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
    selfRoom.user.say('alice', '@hubot pollen london, uk');
    setTimeout(
      () => {
        try {
          assert.deepStrictEqual(selfRoom.messages, [
            ['alice', '@hubot pollen london, uk'],
            ['hubot', 'London, GB Pollen: Low intensity (1.7 grains/m^3 peak) - Grass 1.7, Birch 0.6'],
          ]);
          done();
        } catch (err) {
          done(err);
        }
      },
      100,
    );
  });

  it('responds with a friendly message when geocoding cannot find a location', function (done) {
    mockOpenMeteoGeocodeQuery(
      (query) => `${query.name}`.toLowerCase() === 'london, uk',
      { results: [] },
    );
    mockOpenMeteoGeocodeQuery(
      (query) => `${query.name}`.toLowerCase() === 'london uk',
      { results: [] },
    );
    mockOpenMeteoGeocodeQuery(
      (query) => `${query.name}`.toLowerCase() === 'london gb' && `${query.countryCode}`.toUpperCase() === 'GB',
      { results: [] },
    );
    mockOpenMeteoGeocodeQuery(
      (query) => `${query.name}`.toLowerCase() === 'london' && `${query.countryCode}`.toUpperCase() === 'GB',
      { results: [] },
    );

    const selfRoom = this.room;
    selfRoom.user.say('alice', '@hubot pollen london, uk');
    setTimeout(
      () => {
        try {
          assert.deepStrictEqual(selfRoom.messages, [
            ['alice', '@hubot pollen london, uk'],
            ['hubot', 'I couldn\'t find a location match for "london, uk". Try a simpler place name (for example, "London") or a 5-digit ZIP for US fallback.'],
          ]);
          done();
        } catch (err) {
          done(err);
        }
      },
      100,
    );
  });

  it('responds with a friendly message when Open-Meteo has no usable data and no fallback zip exists', function (done) {
    mockOpenMeteoGeocode('London', {
      name: 'London',
      latitude: 51.5,
      longitude: -0.1,
      country_code: 'GB',
    });
    mockOpenMeteoAirQuality(51.5, -0.1, buildOpenMeteoNoData(51.5, -0.1));

    const selfRoom = this.room;
    selfRoom.user.say('alice', '@hubot pollen London');
    setTimeout(
      () => {
        try {
          assert.deepStrictEqual(selfRoom.messages, [
            ['alice', '@hubot pollen London'],
            ['hubot', 'No usable Open-Meteo pollen forecast is currently available for London, GB. Try a nearby city or provide a postal code for fallback.'],
          ]);
          done();
        } catch (err) {
          done(err);
        }
      },
      100,
    );
  });

  it('prioritizes country-constrained lookup for europe short codes', function (done) {
    mockOpenMeteoGeocodeQuery(
      (query) => `${query.name}`.toLowerCase() === 'berlin de' && `${query.countryCode}`.toUpperCase() === 'DE',
      {
        results: [
          {
            name: 'Berlin',
            latitude: 52.52,
            longitude: 13.41,
            country_code: 'DE',
          },
        ],
      },
    );

    mockOpenMeteoAirQuality(52.52, 13.41, {
      latitude: 52.52,
      longitude: 13.41,
      hourly: {
        alder_pollen: [0.0, 0.0],
        birch_pollen: [1.5, 3.5],
        grass_pollen: [1.1, 2.2],
        mugwort_pollen: [0.0, 0.0],
        olive_pollen: [0.0, 0.1],
        ragweed_pollen: [0.0, 0.0],
      },
    });

    const selfRoom = this.room;
    selfRoom.user.say('alice', '@hubot pollen berlin, de');
    setTimeout(
      () => {
        try {
          assert.deepStrictEqual(selfRoom.messages, [
            ['alice', '@hubot pollen berlin, de'],
            ['hubot', 'Berlin, DE Pollen: Low intensity (3.5 grains/m^3 peak) - Birch 3.5, Grass 2.2, Olive 0.1'],
          ]);
          done();
        } catch (err) {
          done(err);
        }
      },
      100,
    );
  });

  it('supports europe country names as constrained lookups', function (done) {
    mockOpenMeteoGeocodeQuery(
      (query) => `${query.name}`.toLowerCase() === 'berlin de' && `${query.countryCode}`.toUpperCase() === 'DE',
      {
        results: [
          {
            name: 'Berlin',
            latitude: 52.52,
            longitude: 13.41,
            country_code: 'DE',
          },
        ],
      },
    );

    mockOpenMeteoAirQuality(52.52, 13.41, {
      latitude: 52.52,
      longitude: 13.41,
      hourly: {
        alder_pollen: [0.0, 0.0],
        birch_pollen: [1.5, 3.5],
        grass_pollen: [1.1, 2.2],
        mugwort_pollen: [0.0, 0.0],
        olive_pollen: [0.0, 0.1],
        ragweed_pollen: [0.0, 0.0],
      },
    });

    const selfRoom = this.room;
    selfRoom.user.say('alice', '@hubot pollen berlin, germany');
    setTimeout(
      () => {
        try {
          assert.deepStrictEqual(selfRoom.messages, [
            ['alice', '@hubot pollen berlin, germany'],
            ['hubot', 'Berlin, DE Pollen: Low intensity (3.5 grains/m^3 peak) - Birch 3.5, Grass 2.2, Olive 0.1'],
          ]);
          done();
        } catch (err) {
          done(err);
        }
      },
      100,
    );
  });

  it('does not accept wrong-state matches for US city,state queries', function (done) {
    mockOpenMeteoGeocodeQuery(
      (query) => `${query.name}`.toLowerCase() === 'oneida tx' && `${query.countryCode}`.toUpperCase() === 'US',
      {
        results: [
          {
            name: 'Oneida',
            latitude: 43.09,
            longitude: -75.65,
            postcodes: ['13421'],
            country_code: 'US',
            admin1: 'New York',
          },
        ],
      },
    );
    mockOpenMeteoGeocodeQuery(
      (query) => `${query.name}`.toLowerCase() === 'oneida texas' && `${query.countryCode}`.toUpperCase() === 'US',
      { results: [] },
    );
    mockOpenMeteoGeocodeQuery(
      (query) => `${query.name}`.toLowerCase() === 'oneida' && `${query.countryCode}`.toUpperCase() === 'US',
      {
        results: [
          {
            name: 'Oneida',
            latitude: 43.09,
            longitude: -75.65,
            postcodes: ['13421'],
            country_code: 'US',
            admin1: 'New York',
          },
        ],
      },
    );
    mockOpenMeteoGeocodeQuery(
      (query) => `${query.name}`.toLowerCase() === 'oneida, tx',
      { results: [] },
    );
    mockOpenMeteoGeocodeQuery(
      (query) => `${query.name}`.toLowerCase() === 'oneida tx',
      { results: [] },
    );

    const selfRoom = this.room;
    selfRoom.user.say('alice', '@hubot pollen oneida, tx');
    setTimeout(
      () => {
        try {
          assert.deepStrictEqual(selfRoom.messages, [
            ['alice', '@hubot pollen oneida, tx'],
            ['hubot', 'I couldn\'t find a location match for "oneida, tx". Try a simpler place name (for example, "London") or a 5-digit ZIP for US fallback.'],
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
