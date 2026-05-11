/* global describe before beforeEach afterEach it */
/* eslint-disable func-names */
const assert = require('assert');
const sinon = require('sinon');

const buildOpenMeteoGoodForecast = () => ({
  hourly: {
    alder_pollen: [0.0, 0.0],
    birch_pollen: [0.1, 0.6],
    grass_pollen: [1.2, 1.7],
    mugwort_pollen: [0.0, 0.0],
    olive_pollen: [0.0, 0.0],
    ragweed_pollen: [0.0, 0.0],
  },
});

const buildOpenMeteoNoData = () => ({
  hourly: {
    alder_pollen: [null],
    birch_pollen: [null],
    grass_pollen: [null],
    mugwort_pollen: [null],
    olive_pollen: [null],
    ragweed_pollen: [null],
  },
});

const buildPollenComForecast = () => ({
  Location: {
    ZIP: '37206',
    DisplayLocation: 'Nashville, TN',
    periods: [
      { Type: 'Yesterday', Index: 7.8, Triggers: [] },
      {
        Type: 'Today',
        Index: 8.2,
        Triggers: [
          { LGID: 22, Name: 'Alder' },
          { LGID: 272, Name: 'Juniper' },
          { LGID: 4, Name: 'Maple' },
        ],
      },
    ],
  },
});

const formatIndexLabel = (index) => {
  if (index <= 4.8) return 'Low';
  if (index <= 7.2) return 'Medium';
  if (index <= 9.6) return 'Medium-High';
  return 'High';
};

describe('ollama-tools', () => {
  let ollamaTools;
  let mockRobot;
  let mockRegistry;
  let mockRegisteredTools;

  before(function () {
    // eslint-disable-next-line global-require
    ollamaTools = require('../src/ollama-tools');
  });

  beforeEach(function () {
    mockRegisteredTools = {};
    mockRegistry = {
      registerTool: sinon.spy((name, tool) => {
        mockRegisteredTools[name] = tool;
      }),
    };

    mockRobot = {
      logger: {
        debug: sinon.stub(),
        info: sinon.stub(),
        error: sinon.stub(),
      },
    };

    this.consoleStubs = {
      log: sinon.stub(console, 'log'),
      error: sinon.stub(console, 'error'),
      warn: sinon.stub(console, 'warn'),
    };
  });

  afterEach(function () {
    delete process.env.HUBOT_POLLEN_OLLAMA_ENABLED;
    Object.values(this.consoleStubs).forEach((stub) => stub.restore());
  });

  // ─── Enabled / disabled ────────────────────────────────────────────────────

  it('skips registration when HUBOT_POLLEN_OLLAMA_ENABLED is not set', function () {
    delete process.env.HUBOT_POLLEN_OLLAMA_ENABLED;

    ollamaTools(mockRobot, {}, mockRegistry);

    assert(mockRobot.logger.debug.calledWith(sinon.match(/disabled/i)));
    assert.strictEqual(Object.keys(mockRegisteredTools).length, 0);
  });

  it('registers both tools when HUBOT_POLLEN_OLLAMA_ENABLED=true', function () {
    process.env.HUBOT_POLLEN_OLLAMA_ENABLED = 'true';

    const mockFunctions = {
      getOpenMeteoGeocode: sinon.stub(),
      getOpenMeteoForecast: sinon.stub(),
      getPollenForecastData: sinon.stub(),
      summarizeOpenMeteoPollen: sinon.stub(),
      buildOpenMeteoLocationLabel: sinon.stub(),
      extractFallbackZip: sinon.stub(),
      formatIndexLabel: sinon.stub(),
    };

    ollamaTools(mockRobot, mockFunctions, mockRegistry);

    assert('get_pollen_forecast' in mockRegisteredTools, 'get_pollen_forecast should be registered');
    assert('get_pollen_by_coordinates' in mockRegisteredTools, 'get_pollen_by_coordinates should be registered');
    assert(mockRegistry.registerTool.calledTwice);
  });

  // ─── get_pollen_forecast ───────────────────────────────────────────────────

  it('get_pollen_forecast returns Open-Meteo data when available', async function () {
    process.env.HUBOT_POLLEN_OLLAMA_ENABLED = 'true';

    const geoLocation = {
      name: 'London', latitude: 51.5, longitude: -0.1, country_code: 'GB',
    };

    const mockFunctions = {
      getOpenMeteoGeocode: (query, cb) => cb(null, geoLocation),
      getOpenMeteoForecast: (loc, cb) => cb(null, buildOpenMeteoGoodForecast()),
      getPollenForecastData: sinon.stub(),
      summarizeOpenMeteoPollen: () => ({
        intensity: 'Low',
        topPeak: 1.7,
        entries: [
          { label: 'Grass', peak: 1.7 },
          { label: 'Birch', peak: 0.6 },
        ],
        hasPositivePollen: true,
      }),
      buildOpenMeteoLocationLabel: () => 'London, GB',
      extractFallbackZip: () => null,
      formatIndexLabel,
    };

    ollamaTools(mockRobot, mockFunctions, mockRegistry);

    const result = await mockRegisteredTools.get_pollen_forecast.handler({ location: 'London' });

    assert.strictEqual(result.source, 'open-meteo');
    assert.strictEqual(result.location, 'London, GB');
    assert.strictEqual(result.intensity, 'Low');
    assert.strictEqual(result.peak_grains_per_m3, 1.7);
    assert.deepStrictEqual(result.pollen_types, [
      { type: 'Grass', peak: 1.7 },
      { type: 'Birch', peak: 0.6 },
    ]);
    assert.deepStrictEqual(result.coordinates, { latitude: 51.5, longitude: -0.1 });
  });

  it('get_pollen_forecast falls back to Pollen.com when Open-Meteo has no data', async function () {
    process.env.HUBOT_POLLEN_OLLAMA_ENABLED = 'true';

    const geoLocation = {
      name: 'Nashville', latitude: 36.17, longitude: -86.78, country_code: 'US', admin1: 'Tennessee',
    };

    const mockFunctions = {
      getOpenMeteoGeocode: (query, cb) => cb(null, geoLocation),
      getOpenMeteoForecast: (loc, cb) => cb(null, buildOpenMeteoNoData()),
      getPollenForecastData: (zip, cb) => cb(null, buildPollenComForecast()),
      summarizeOpenMeteoPollen: () => null,
      buildOpenMeteoLocationLabel: () => 'Nashville, TN',
      extractFallbackZip: () => '37206',
      formatIndexLabel,
    };

    ollamaTools(mockRobot, mockFunctions, mockRegistry);

    const result = await mockRegisteredTools.get_pollen_forecast.handler({ location: '37206' });

    assert.strictEqual(result.source, 'pollen.com');
    assert.strictEqual(result.location, 'Nashville, TN');
    assert.strictEqual(result.zip, '37206');
    assert.strictEqual(result.index, 8.2);
    assert.strictEqual(result.level, 'Medium-High');
    assert.deepStrictEqual(result.triggers, ['Alder', 'Juniper', 'Maple']);
  });

  it('get_pollen_forecast falls back to Pollen.com when geocoding fails but ZIP is in query', async function () {
    process.env.HUBOT_POLLEN_OLLAMA_ENABLED = 'true';

    const geocodeError = new Error('Open-Meteo could not geocode "37206"');
    geocodeError.code = 'GEOCODE_NOT_FOUND';

    const mockFunctions = {
      getOpenMeteoGeocode: (query, cb) => cb(geocodeError),
      getOpenMeteoForecast: sinon.stub(),
      getPollenForecastData: (zip, cb) => cb(null, buildPollenComForecast()),
      summarizeOpenMeteoPollen: sinon.stub(),
      buildOpenMeteoLocationLabel: sinon.stub(),
      extractFallbackZip: (query) => (/\b\d{5}\b/.test(query) ? query.match(/\b(\d{5})\b/)[1] : null),
      formatIndexLabel,
    };

    ollamaTools(mockRobot, mockFunctions, mockRegistry);

    const result = await mockRegisteredTools.get_pollen_forecast.handler({ location: '37206' });

    assert.strictEqual(result.source, 'pollen.com');
    assert.strictEqual(result.zip, '37206');
  });

  it('get_pollen_forecast rejects when geocoding fails and no ZIP fallback', async function () {
    process.env.HUBOT_POLLEN_OLLAMA_ENABLED = 'true';

    const geocodeError = new Error('Open-Meteo could not geocode "nowhere"');
    geocodeError.code = 'GEOCODE_NOT_FOUND';

    const mockFunctions = {
      getOpenMeteoGeocode: (query, cb) => cb(geocodeError),
      getOpenMeteoForecast: sinon.stub(),
      getPollenForecastData: sinon.stub(),
      summarizeOpenMeteoPollen: sinon.stub(),
      buildOpenMeteoLocationLabel: sinon.stub(),
      extractFallbackZip: () => null,
      formatIndexLabel,
    };

    ollamaTools(mockRobot, mockFunctions, mockRegistry);

    await assert.rejects(
      () => mockRegisteredTools.get_pollen_forecast.handler({ location: 'nowhere' }),
      (err) => {
        assert(err.message.includes('Could not find location'));
        return true;
      },
    );
  });

  it('get_pollen_forecast returns None intensity when Open-Meteo has no data and no fallback ZIP', async function () {
    process.env.HUBOT_POLLEN_OLLAMA_ENABLED = 'true';

    const geoLocation = {
      name: 'Anchorage', latitude: 61.2, longitude: -149.9, country_code: 'US', admin1: 'Alaska',
    };

    const mockFunctions = {
      getOpenMeteoGeocode: (query, cb) => cb(null, geoLocation),
      getOpenMeteoForecast: (loc, cb) => cb(null, buildOpenMeteoNoData()),
      getPollenForecastData: sinon.stub(),
      summarizeOpenMeteoPollen: () => null,
      buildOpenMeteoLocationLabel: () => 'Anchorage, AK',
      extractFallbackZip: () => null,
      formatIndexLabel,
    };

    ollamaTools(mockRobot, mockFunctions, mockRegistry);

    const result = await mockRegisteredTools.get_pollen_forecast.handler({ location: 'Anchorage, AK' });

    assert.strictEqual(result.source, 'open-meteo');
    assert.strictEqual(result.intensity, 'None');
    assert.strictEqual(result.peak_grains_per_m3, 0);
    assert.deepStrictEqual(result.pollen_types, []);
  });

  // ─── get_pollen_by_coordinates ─────────────────────────────────────────────

  it('get_pollen_by_coordinates returns pollen data for valid coordinates', async function () {
    process.env.HUBOT_POLLEN_OLLAMA_ENABLED = 'true';

    const mockFunctions = {
      getOpenMeteoGeocode: sinon.stub(),
      getOpenMeteoForecast: (coords, cb) => cb(null, buildOpenMeteoGoodForecast()),
      getPollenForecastData: sinon.stub(),
      summarizeOpenMeteoPollen: () => ({
        intensity: 'Low',
        topPeak: 1.7,
        entries: [
          { label: 'Grass', peak: 1.7 },
          { label: 'Birch', peak: 0.6 },
        ],
        hasPositivePollen: true,
      }),
      buildOpenMeteoLocationLabel: sinon.stub(),
      extractFallbackZip: sinon.stub(),
      formatIndexLabel,
    };

    ollamaTools(mockRobot, mockFunctions, mockRegistry);

    const result = await mockRegisteredTools.get_pollen_by_coordinates.handler({
      latitude: 51.5,
      longitude: -0.1,
    });

    assert.strictEqual(result.source, 'open-meteo');
    assert.deepStrictEqual(result.coordinates, { latitude: 51.5, longitude: -0.1 });
    assert.strictEqual(result.intensity, 'Low');
    assert.strictEqual(result.peak_grains_per_m3, 1.7);
    assert.deepStrictEqual(result.pollen_types, [
      { type: 'Grass', peak: 1.7 },
      { type: 'Birch', peak: 0.6 },
    ]);
  });

  it('get_pollen_by_coordinates returns None intensity when no pollen data', async function () {
    process.env.HUBOT_POLLEN_OLLAMA_ENABLED = 'true';

    const mockFunctions = {
      getOpenMeteoGeocode: sinon.stub(),
      getOpenMeteoForecast: (coords, cb) => cb(null, buildOpenMeteoNoData()),
      getPollenForecastData: sinon.stub(),
      summarizeOpenMeteoPollen: () => null,
      buildOpenMeteoLocationLabel: sinon.stub(),
      extractFallbackZip: sinon.stub(),
      formatIndexLabel,
    };

    ollamaTools(mockRobot, mockFunctions, mockRegistry);

    const result = await mockRegisteredTools.get_pollen_by_coordinates.handler({
      latitude: 61.2,
      longitude: -149.9,
    });

    assert.strictEqual(result.source, 'open-meteo');
    assert.strictEqual(result.intensity, 'None');
    assert.strictEqual(result.peak_grains_per_m3, 0);
    assert.deepStrictEqual(result.pollen_types, []);
  });

  it('get_pollen_by_coordinates rejects on forecast error', async function () {
    process.env.HUBOT_POLLEN_OLLAMA_ENABLED = 'true';

    const mockFunctions = {
      getOpenMeteoGeocode: sinon.stub(),
      getOpenMeteoForecast: (coords, cb) => cb(new Error('HTTP 503')),
      getPollenForecastData: sinon.stub(),
      summarizeOpenMeteoPollen: sinon.stub(),
      buildOpenMeteoLocationLabel: sinon.stub(),
      extractFallbackZip: sinon.stub(),
      formatIndexLabel,
    };

    ollamaTools(mockRobot, mockFunctions, mockRegistry);

    await assert.rejects(
      () => mockRegisteredTools.get_pollen_by_coordinates.handler({ latitude: 51.5, longitude: -0.1 }),
      (err) => {
        assert(err.message.includes('Could not retrieve pollen forecast'));
        return true;
      },
    );
  });
});
