// Description:
//   Pollen tools for Ollama integration
//
// Configuration:
//   HUBOT_POLLEN_OLLAMA_ENABLED  Set to 'true' to register pollen tools with hubot-ollama

// eslint-disable-next-line default-param-last
module.exports = (robot, {
  getOpenMeteoGeocode,
  getOpenMeteoForecast,
  getPollenForecastData,
  summarizeOpenMeteoPollen,
  buildOpenMeteoLocationLabel,
  extractFallbackZip,
  formatIndexLabel,
}, _registryForTest = null) => {
  /**
   * Register tools for Ollama integration if enabled
   */
  if (process.env.HUBOT_POLLEN_OLLAMA_ENABLED !== 'true') {
    robot.logger.debug('Pollen Ollama tools disabled (set HUBOT_POLLEN_OLLAMA_ENABLED=true to enable)');
    return;
  }

  robot.logger.info('Registering Pollen tools with Ollama');

  try {
    let registry;
    if (_registryForTest) {
      registry = _registryForTest;
    } else {
      // Resolve the registry once using explicit search paths for linked installs
      // eslint-disable-next-line global-require
      const path = require('path');
      const registryPath = require.resolve('hubot-ollama/src/tool-registry', {
        paths: [
          __dirname,
          path.resolve(__dirname, '../../node_modules'),
          path.resolve(__dirname, '../../../node_modules'),
          process.cwd(),
        ],
      });
      // eslint-disable-next-line global-require, import/no-unresolved, import/no-dynamic-require
      registry = require(registryPath);
    }

    robot.logger.info('Tool registry loaded successfully');

    /**
     * Helper: build a Pollen.com result object from a raw forecast response
     */
    const buildPollenComResult = (forecast) => {
      const period = forecast.Location
        && forecast.Location.periods
        && forecast.Location.periods[1];

      if (!period || !period.Index) {
        return {
          source: 'pollen.com',
          location: forecast.Location ? forecast.Location.DisplayLocation : 'Unknown',
          error: 'No forecast available',
        };
      }

      const triggers = period.Triggers
        ? Object.values(period.Triggers).filter((t) => t && t.Name).map((t) => t.Name)
        : [];

      return {
        source: 'pollen.com',
        location: forecast.Location.DisplayLocation,
        zip: forecast.Location.ZIP,
        index: period.Index,
        level: formatIndexLabel(period.Index),
        triggers,
      };
    };

    /**
     * Tool: get_pollen_forecast
     * Geocodes a location string then queries Open-Meteo for pollen data,
     * falling back to Pollen.com when a US ZIP is available.
     */
    const pollenForecastTool = {
      description: 'Get the current pollen forecast for a location. Returns pollen intensity, peak concentration, and active pollen types. Uses Open-Meteo as the primary source with automatic fallback to Pollen.com for US ZIP codes when Open-Meteo has no data.',
      parameters: {
        type: 'object',
        required: ['location'],
        properties: {
          location: {
            type: 'string',
            description: 'Location to get pollen forecast for. Can be a city name, city/state, city/country, or US ZIP code (e.g., "Nashville, TN", "London", "37203").',
          },
        },
      },
      handler: async ({ location }) => new Promise((resolve, reject) => {
        const query = `${location}`.trim();
        const fallbackZipFromQuery = extractFallbackZip(query, null);

        getOpenMeteoGeocode(query, (geocodeErr, geoLocation) => {
          if (geocodeErr) {
            robot.logger.debug(`Geocoding failed for "${query}":`, geocodeErr.message);

            if (fallbackZipFromQuery) {
              getPollenForecastData(fallbackZipFromQuery, (pollenErr, forecast) => {
                if (pollenErr) {
                  reject(new Error(`Could not retrieve pollen data: ${pollenErr.message}`));
                  return;
                }
                resolve(buildPollenComResult(forecast));
              });
              return;
            }

            reject(new Error(`Could not find location: ${location}`));
            return;
          }

          const fallbackZip = extractFallbackZip(query, geoLocation);

          getOpenMeteoForecast(geoLocation, (forecastErr, forecast) => {
            if (!forecastErr) {
              const summary = summarizeOpenMeteoPollen(forecast);
              if (summary) {
                robot.logger.debug('Open-Meteo pollen result:', summary);
                resolve({
                  source: 'open-meteo',
                  location: buildOpenMeteoLocationLabel(geoLocation),
                  coordinates: {
                    latitude: geoLocation.latitude,
                    longitude: geoLocation.longitude,
                  },
                  intensity: summary.intensity,
                  peak_grains_per_m3: summary.topPeak,
                  pollen_types: summary.entries.map((e) => ({ type: e.label, peak: e.peak })),
                });
                return;
              }
            }

            if (fallbackZip) {
              robot.logger.debug('Open-Meteo had no usable pollen data, falling back to Pollen.com', { fallbackZip });
              getPollenForecastData(fallbackZip, (pollenErr, pollenForecast) => {
                if (pollenErr) {
                  reject(new Error(`Could not retrieve pollen data: ${pollenErr.message}`));
                  return;
                }
                resolve(buildPollenComResult(pollenForecast));
              });
              return;
            }

            if (forecastErr) {
              reject(new Error(`Could not retrieve pollen forecast: ${forecastErr.message}`));
              return;
            }

            // Open-Meteo geocoded but returned no usable pollen and no ZIP fallback available
            resolve({
              source: 'open-meteo',
              location: buildOpenMeteoLocationLabel(geoLocation),
              coordinates: {
                latitude: geoLocation.latitude,
                longitude: geoLocation.longitude,
              },
              intensity: 'None',
              peak_grains_per_m3: 0,
              pollen_types: [],
            });
          });
        });
      }),
    };

    registry.registerTool('get_pollen_forecast', pollenForecastTool);
    robot.logger.info('Registered get_pollen_forecast tool');

    /**
     * Tool: get_pollen_by_coordinates
     * Queries Open-Meteo directly for pollen data at given coordinates.
     */
    const pollenByCoordinatesTool = {
      description: 'Get the current pollen forecast for specific geographic coordinates using Open-Meteo. Returns pollen intensity, peak concentration, and active pollen types. Useful when you already have latitude and longitude.',
      parameters: {
        type: 'object',
        required: ['latitude', 'longitude'],
        properties: {
          latitude: {
            type: 'number',
            description: 'Latitude coordinate',
          },
          longitude: {
            type: 'number',
            description: 'Longitude coordinate',
          },
        },
      },
      handler: async ({ latitude, longitude }) => new Promise((resolve, reject) => {
        const coords = { latitude, longitude };

        getOpenMeteoForecast(coords, (err, forecast) => {
          if (err) {
            reject(new Error(`Could not retrieve pollen forecast: ${err.message}`));
            return;
          }

          const summary = summarizeOpenMeteoPollen(forecast);
          if (!summary) {
            resolve({
              source: 'open-meteo',
              coordinates: { latitude, longitude },
              intensity: 'None',
              peak_grains_per_m3: 0,
              pollen_types: [],
            });
            return;
          }

          robot.logger.debug('Open-Meteo coordinate pollen result:', summary);
          resolve({
            source: 'open-meteo',
            coordinates: { latitude, longitude },
            intensity: summary.intensity,
            peak_grains_per_m3: summary.topPeak,
            pollen_types: summary.entries.map((e) => ({ type: e.label, peak: e.peak })),
          });
        });
      }),
    };

    registry.registerTool('get_pollen_by_coordinates', pollenByCoordinatesTool);
    robot.logger.info('Registered get_pollen_by_coordinates tool');

    robot.logger.info('Pollen tools registered with Ollama');
  } catch (err) {
    // hubot-ollama not installed, silently ignore
    if (err.code !== 'MODULE_NOT_FOUND') {
      robot.logger.error(`Failed to register Pollen tools with Ollama: ${err.message}`, err);
    } else {
      robot.logger.debug('hubot-ollama not installed, skipping Ollama tool registration');
    }
  }
};
