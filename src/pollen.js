// Description:
//   Retrieves the latest pollen forecast using Open-Meteo first,
//   with fallback to Pollen.com when needed.
//
// Configuration:
//   HUBOT_POLLEN_ZIP            - Default location query when none is provided (e.g., 37203, London)
//   HUBOT_POLLEN_OLLAMA_ENABLED - Set to 'true' to register pollen tools with hubot-ollama
//
// Commands:
//   hubot pollen            - Show today's pollen levels for the default location query
//   hubot pollen <zip>      - Show today's pollen levels for the given 5-digit ZIP
//   hubot pollen <search>   - Show today's pollen levels for a geocoded location query
//
// Author:
//   stephenyeargin

const dayjs = require('dayjs');

module.exports = (robot) => {
  const usStateNamesByAbbreviation = {
    AL: 'Alabama',
    AK: 'Alaska',
    AZ: 'Arizona',
    AR: 'Arkansas',
    CA: 'California',
    CO: 'Colorado',
    CT: 'Connecticut',
    DE: 'Delaware',
    FL: 'Florida',
    GA: 'Georgia',
    HI: 'Hawaii',
    ID: 'Idaho',
    IL: 'Illinois',
    IN: 'Indiana',
    IA: 'Iowa',
    KS: 'Kansas',
    KY: 'Kentucky',
    LA: 'Louisiana',
    ME: 'Maine',
    MD: 'Maryland',
    MA: 'Massachusetts',
    MI: 'Michigan',
    MN: 'Minnesota',
    MS: 'Mississippi',
    MO: 'Missouri',
    MT: 'Montana',
    NE: 'Nebraska',
    NV: 'Nevada',
    NH: 'New Hampshire',
    NJ: 'New Jersey',
    NM: 'New Mexico',
    NY: 'New York',
    NC: 'North Carolina',
    ND: 'North Dakota',
    OH: 'Ohio',
    OK: 'Oklahoma',
    OR: 'Oregon',
    PA: 'Pennsylvania',
    RI: 'Rhode Island',
    SC: 'South Carolina',
    SD: 'South Dakota',
    TN: 'Tennessee',
    TX: 'Texas',
    UT: 'Utah',
    VT: 'Vermont',
    VA: 'Virginia',
    WA: 'Washington',
    WV: 'West Virginia',
    WI: 'Wisconsin',
    WY: 'Wyoming',
    DC: 'District of Columbia',
  };
  const countryCodeAliases = {
    UK: 'GB',
    GBR: 'GB',
    USA: 'US',
  };
  const countryNameToCode = {
    austria: 'AT',
    belgium: 'BE',
    bulgaria: 'BG',
    croatia: 'HR',
    cyprus: 'CY',
    czechia: 'CZ',
    'czech republic': 'CZ',
    denmark: 'DK',
    estonia: 'EE',
    finland: 'FI',
    france: 'FR',
    germany: 'DE',
    greece: 'GR',
    hungary: 'HU',
    ireland: 'IE',
    italy: 'IT',
    latvia: 'LV',
    lithuania: 'LT',
    luxembourg: 'LU',
    malta: 'MT',
    netherlands: 'NL',
    norway: 'NO',
    poland: 'PL',
    portugal: 'PT',
    romania: 'RO',
    slovakia: 'SK',
    slovenia: 'SI',
    spain: 'ES',
    sweden: 'SE',
    switzerland: 'CH',
    'united kingdom': 'GB',
    england: 'GB',
    scotland: 'GB',
    wales: 'GB',
    'northern ireland': 'GB',
    uk: 'GB',
  };
  const openMeteoGeocodeApiUrl = 'https://geocoding-api.open-meteo.com/v1/search';
  const openMeteoAirQualityApiUrl = 'https://air-quality-api.open-meteo.com/v1/air-quality';
  const openMeteoPollenTypes = [
    { key: 'alder_pollen', label: 'Alder' },
    { key: 'birch_pollen', label: 'Birch' },
    { key: 'grass_pollen', label: 'Grass' },
    { key: 'mugwort_pollen', label: 'Mugwort' },
    { key: 'olive_pollen', label: 'Olive' },
    { key: 'ragweed_pollen', label: 'Ragweed' },
  ];
  const apiUrl = 'https://www.pollen.com/api/forecast/current/pollen';
  const webUrl = 'https://www.pollen.com/forecast/current/pollen';
  const userAgentString = 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:75.0) Gecko/20100101 Firefox/75.0';
  const defaultZipCode = process.env.HUBOT_POLLEN_ZIP || 37203;

  const handleError = (err, msg) => {
    robot.logger.error(err);
    return msg.send(`Error retrieving forecast: ${err}`);
  };

  const formatIndexColor = (index) => {
    if (index.toFixed(1) <= 2.4) {
      return 'good';
    }
    if (index.toFixed(1) <= 4.8) {
      return 'warning';
    }
    if (index.toFixed(1) <= 7.2) {
      return 'warning';
    }
    if (index.toFixed(1) <= 9.6) {
      return 'danger';
    }
    if (index.toFixed(1) <= 12.0) {
      return 'danger';
    }
    return 'danger';
  };

  const formatIndexLabel = (index) => {
    if (index.toFixed(1) <= 2.4) {
      return 'Low';
    }
    if (index.toFixed(1) <= 4.8) {
      return 'Medium-Low';
    }
    if (index.toFixed(1) <= 7.2) {
      return 'Medium';
    }
    if (index.toFixed(1) <= 9.6) {
      return 'Medium-High';
    }
    if (index.toFixed(1) <= 12.0) {
      return 'High';
    }
    return 'Death by Pollen';
  };

  const formatForecast = (forecast) => {
    // Send default message if no forecast available
    let payload;
    if (
      !forecast.Location
      || !forecast.Location.DisplayLocation
      || !forecast.Location.periods
      || forecast.Location.periods.length === 0
    ) {
      return `${forecast.Location ? forecast.Location.ZIP : 'Unknown'} Pollen: No forecast available.`;
    }

    // Skip to only today's forecast (check for structure)
    const period = forecast.Location.periods[1];
    if (!period || !period.Index) {
      return 'Pollen forecast is unavailable for today.';
    }

    const index = period.Index;

    // Allergens list
    const triggers = [];
    if (period.Triggers) {
      Object.keys(period.Triggers).forEach((k) => {
        const row = period.Triggers[k];
        if (row && row.Name) {
          triggers.push(`${row.Name}`);
        }
      });
    }

    if (triggers.length === 0) {
      triggers.push('The pollen season in the area has completed.');
    }

    // Check for Slack adapter: covers both legacy 'slack' and modern '@hubot-friends/hubot-slack'
    const isSlack = robot.adapterName?.includes('slack') || robot.adapter?.constructor?.name === 'SlackBot';

    robot.logger.debug('Adapter detection', {
      adapterName: robot.adapterName,
      constructorName: robot.adapter?.constructor?.name,
      isSlack,
    });

    if (isSlack) {
      // Slack adapter
      return {
        attachments: [
          {
            fallback: `${forecast.Location.DisplayLocation} Pollen: ${index} (${formatIndexLabel(index)}) - ${triggers.join(', ')}`,
            title: `${forecast.Location.DisplayLocation} Pollen`,
            title_link: `https://www.pollen.com/forecast/current/pollen/${forecast.Location.ZIP}`,
            author_name: 'Pollen.com',
            author_link: 'https://www.pollen.com/',
            author_icon: 'https://www.pollen.com/Content/favicon/apple-touch-icon-72x72.png',
            footer: 'Pollen.com',
            color: formatIndexColor(index),
            fields: [
              {
                title: 'Level',
                value: formatIndexLabel(index),
                short: true,
              },
              {
                title: 'Count',
                value: index.toFixed(1),
                short: true,
              },
              {
                title: 'Types',
                value: triggers.join(', '),
                short: false,
              },
            ],
            ts: dayjs(forecast.ForecastDate).unix(),
          },
        ],
      };
    }

    // IRC/etc. formatting
    payload = `${forecast.Location.DisplayLocation} Pollen: `;
    payload += `${index} (${formatIndexLabel(index)}) - `;
    payload += triggers.join(', ');

    return payload;
  };

  const extractZipFromText = (text) => {
    const value = `${text || ''}`.trim();
    const match = value.match(/\b([0-9]{5})\b/);
    return match ? match[1] : null;
  };

  const extractFallbackZip = (query, location) => {
    const fromQuery = extractZipFromText(query);
    if (fromQuery) {
      return fromQuery;
    }

    if (location && Array.isArray(location.postcodes)) {
      for (let i = 0; i < location.postcodes.length; i += 1) {
        const postcode = extractZipFromText(location.postcodes[i]);
        if (postcode) {
          return postcode;
        }
      }
    }

    return null;
  };

  const buildOpenMeteoLocationLabel = (location) => {
    const countryCode = `${location.country_code || ''}`.toUpperCase();
    if (countryCode === 'US' && location.admin1) {
      return `${location.name}, ${location.admin1}`;
    }

    if (countryCode && location.name) {
      return `${location.name}, ${countryCode}`;
    }

    return location.name || 'Unknown';
  };

  const formatOpenMeteoIntensity = (index) => {
    if (index <= 0.1) {
      return 'None';
    }
    if (index <= 1.0) {
      return 'Very Low';
    }
    if (index <= 5.0) {
      return 'Low';
    }
    if (index <= 20.0) {
      return 'Moderate';
    }
    return 'High';
  };

  const formatOpenMeteoColor = (index) => {
    if (index <= 1.0) {
      return 'good';
    }
    if (index <= 5.0) {
      return 'warning';
    }
    return 'danger';
  };

  const summarizeOpenMeteoPollen = (forecast) => {
    const hourly = forecast && forecast.hourly ? forecast.hourly : null;
    if (!hourly) {
      return null;
    }

    const peaks = openMeteoPollenTypes.map((type) => {
      const values = Array.isArray(hourly[type.key]) ? hourly[type.key] : [];
      const numericValues = values.filter((value) => Number.isFinite(value));
      const peak = numericValues.length ? Math.max(...numericValues) : null;
      return {
        label: type.label,
        peak,
      };
    });

    const hasNumericData = peaks.some((row) => Number.isFinite(row.peak));
    if (!hasNumericData) {
      return null;
    }

    const sortedPeaks = peaks
      .filter((row) => Number.isFinite(row.peak))
      .sort((a, b) => b.peak - a.peak);

    const topPositivePeaks = sortedPeaks.filter((row) => row.peak > 0).slice(0, 3);
    const displayPeaks = topPositivePeaks.length > 0 ? topPositivePeaks : sortedPeaks.slice(0, 3);
    const topPeak = sortedPeaks.length > 0 ? sortedPeaks[0].peak : 0;

    return {
      topPeak,
      intensity: formatOpenMeteoIntensity(topPeak),
      entries: displayPeaks,
      hasPositivePollen: topPositivePeaks.length > 0,
    };
  };

  const formatOpenMeteoForecast = (location, forecast) => {
    const summary = summarizeOpenMeteoPollen(forecast);
    if (!summary) {
      return null;
    }

    const locationLabel = buildOpenMeteoLocationLabel(location);
    const isSlack = robot.adapterName?.includes('slack') || robot.adapter?.constructor?.name === 'SlackBot';
    const intensity = summary.intensity;
    const count = summary.topPeak.toFixed(1);
    const types = summary.hasPositivePollen
      ? summary.entries.map((entry) => `${entry.label} ${entry.peak.toFixed(1)}`).join(', ')
      : 'No measurable pollen detected today.';

    if (isSlack) {
      return {
        attachments: [
          {
            fallback: `${locationLabel} Pollen: ${intensity} intensity (${count} grains/m^3 peak) - ${types}`,
            title: `${locationLabel} Pollen`,
            title_link: 'https://open-meteo.com/en/docs/air-quality-api',
            author_name: 'Open-Meteo',
            author_link: 'https://open-meteo.com/',
            footer: 'Data: Open-Meteo',
            color: formatOpenMeteoColor(summary.topPeak),
            fields: [
              {
                title: 'Intensity',
                value: `${intensity} (Open-Meteo model scale)`,
                short: true,
              },
              {
                title: 'Peak',
                value: `${count} grains/m^3`,
                short: true,
              },
              {
                title: 'Types',
                value: types,
                short: false,
              },
            ],
            ts: dayjs().unix(),
          },
        ],
      };
    }

    return `${locationLabel} Pollen: ${intensity} intensity (${count} grains/m^3 peak) - ${types}`;
  };

  const sendFriendlyNoDataMessage = (msg, query, location) => {
    const trimmedQuery = `${query || ''}`.trim();
    if (location) {
      const locationLabel = buildOpenMeteoLocationLabel(location);
      msg.send(`No usable Open-Meteo pollen forecast is currently available for ${locationLabel}. Try a nearby city or provide a postal code for fallback.`);
      return;
    }

    msg.send(`I couldn't find a location match for "${trimmedQuery}". Try a simpler place name (for example, "London") or a 5-digit ZIP for US fallback.`);
  };

  const getOpenMeteoGeocode = (query, cb) => {
    const isExactZip = /^[0-9]{5}$/.test(`${query}`.trim());
    const sanitized = `${query || ''}`
      .trim()
      .replace(/\s+/g, ' ');
    const supportedCountryCodes = new Set([
      ...Object.values(countryCodeAliases),
      ...Object.values(countryNameToCode),
    ]);
    const preferredAttempts = [];
    const fallbackAttempts = [];
    const seen = new Set();
    const normalizeRegionText = (value) => `${value || ''}`
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    const addAttempt = (name, countryCode, preferred, expectedAdmin1) => {
      const cleanName = `${name || ''}`.trim().replace(/\s+/g, ' ');
      if (!cleanName) {
        return;
      }

      const key = `${cleanName.toLowerCase()}|${(countryCode || '').toUpperCase()}`;
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      const target = {
        name: cleanName,
        countryCode: countryCode || null,
        expectedAdmin1: Array.isArray(expectedAdmin1) ? expectedAdmin1 : (expectedAdmin1 ? [expectedAdmin1] : null),
      };

      if (preferred) {
        preferredAttempts.push(target);
      } else {
        fallbackAttempts.push(target);
      }
    };

    addAttempt(sanitized, null, false);

    if (!isExactZip) {
      addAttempt(sanitized.replace(/,/g, ' '), null, false);
      addAttempt(sanitized.replace(/[^a-zA-Z0-9\s]/g, ' '), null, false);

      const commaRegionMatch = sanitized.match(/^(.+?),\s*([a-zA-Z]{2,3})$/);
      if (commaRegionMatch) {
        const city = commaRegionMatch[1].trim();
        const regionToken = commaRegionMatch[2].toUpperCase();
        const stateName = usStateNamesByAbbreviation[regionToken];
        const isKnownCountryCode = supportedCountryCodes.has(regionToken);

        if (stateName && isKnownCountryCode) {
          addAttempt(`${city} ${regionToken}`, regionToken, true);
          addAttempt(city, regionToken, true);
          addAttempt(`${city} ${regionToken}`, 'US', true, [stateName, regionToken]);
          addAttempt(`${city} ${stateName}`, 'US', true, [stateName, regionToken]);
          addAttempt(city, 'US', true, [stateName, regionToken]);
        } else if (stateName) {
          addAttempt(`${city} ${regionToken}`, 'US', true, [stateName, regionToken]);
          addAttempt(`${city} ${stateName}`, 'US', true, [stateName, regionToken]);
          addAttempt(city, 'US', true, [stateName, regionToken]);
        } else {
          const normalizedCountryCode = countryCodeAliases[regionToken] || regionToken;
          addAttempt(`${city} ${normalizedCountryCode}`, normalizedCountryCode, true);
          addAttempt(city, normalizedCountryCode, true);
        }
      }

      const commaCountryNameMatch = sanitized.match(/^(.+?),\s*([a-zA-Z][a-zA-Z\s'-]+)$/);
      if (commaCountryNameMatch) {
        const city = commaCountryNameMatch[1].trim();
        const rawCountryName = commaCountryNameMatch[2].trim().toLowerCase();
        const normalizedCountryName = rawCountryName.replace(/\s+/g, ' ');
        const countryCode = countryNameToCode[normalizedCountryName];

        if (countryCode) {
          addAttempt(`${city} ${countryCode}`, countryCode, true);
          addAttempt(city, countryCode, true);
        }
      }
    }

    const attempts = [...preferredAttempts, ...fallbackAttempts];

    const tryAttempt = (index) => {
      if (index >= attempts.length) {
        const error = new Error(`Open-Meteo could not geocode "${query}"`);
        error.code = 'GEOCODE_NOT_FOUND';
        cb(error);
        return;
      }

      const attempt = attempts[index];
      let geocodeUrl = `${openMeteoGeocodeApiUrl}?name=${encodeURIComponent(attempt.name)}&count=10&language=en&format=json`;
      if (attempt.countryCode) {
        geocodeUrl += `&countryCode=${encodeURIComponent(attempt.countryCode)}`;
      }

      robot.http(geocodeUrl)
        .timeout(1000)
        .get()((err, res, body) => {
          if (err) {
            cb(err);
            return;
          }

          if (!res || res.statusCode !== 200) {
            cb(new Error(`Open-Meteo geocoding HTTP ${res ? res.statusCode : 'unknown'}`));
            return;
          }

          let payload;
          try {
            payload = JSON.parse(body);
          } catch (parseError) {
            cb(new Error(`Open-Meteo geocoding parse error: ${parseError.message}`));
            return;
          }

          if (payload.results && payload.results.length > 0) {
            const matchingResult = payload.results.find((result) => {
              if (attempt.expectedAdmin1) {
                const actualAdmin = normalizeRegionText(result.admin1);
                return attempt.expectedAdmin1.some((expectedValue) => {
                  const expectedAdmin = normalizeRegionText(expectedValue);
                  return expectedAdmin === actualAdmin;
                });
              }

              return true;
            });

            if (matchingResult) {
              cb(null, matchingResult);
              return;
            }

            tryAttempt(index + 1);
            return;
          }

          tryAttempt(index + 1);
        });
    };

    tryAttempt(0);
  };

  const getOpenMeteoForecast = (location, cb) => {
    const hourly = openMeteoPollenTypes.map((type) => type.key).join(',');
    const airQualityUrl = `${openMeteoAirQualityApiUrl}?latitude=${location.latitude}&longitude=${location.longitude}&hourly=${hourly}&forecast_days=1&timezone=auto`;

    robot.http(airQualityUrl)
      .timeout(1000)
      .get()((err, res, body) => {
        if (err) {
          cb(err);
          return;
        }

        if (!res || res.statusCode !== 200) {
          cb(new Error(`Open-Meteo air-quality HTTP ${res ? res.statusCode : 'unknown'}`));
          return;
        }

        let payload;
        try {
          payload = JSON.parse(body);
        } catch (parseError) {
          cb(new Error(`Open-Meteo air-quality parse error: ${parseError.message}`));
          return;
        }

        cb(null, payload);
      });
  };

  const getPollenForecastData = (zip, cb) => {
    robot.logger.debug('zip', zip);
    const requestHeaders = {
      'User-Agent': userAgentString,
      referer: `${webUrl}/${zip}`,
    };
    robot.http(`${apiUrl}/${zip}`)
      .timeout(200)
      .headers(requestHeaders)
      .get()((err, res, body) => {
        if (err) {
          cb(err);
          return;
        }
        if (res.statusCode !== 200) {
          cb(new Error(`Server responded with HTTP ${res.statusCode}`));
          return;
        }
        let forecast;
        try {
          forecast = JSON.parse(body);
        } catch (parseError) {
          cb(new Error(`Error parsing JSON response: ${parseError}`));
          return;
        }
        robot.logger.debug('forecast', forecast);
        cb(null, forecast);
      });
  };

  const getPollenForecast = (zip, msg) => {
    getPollenForecastData(zip, (err, forecast) => {
      if (err) {
        handleError(err.message, msg);
        return;
      }
      const formattedMessage = formatForecast(forecast);
      robot.logger.debug('formattedMessage type', typeof formattedMessage);
      robot.logger.debug('formattedMessage', formattedMessage);
      msg.send(formattedMessage);
    });
  };

  const getForecast = (query, msg) => {
    const locationQuery = `${query}`.trim();
    const fallbackZipFromQuery = extractFallbackZip(locationQuery, null);

    getOpenMeteoGeocode(locationQuery, (geocodeErr, location) => {
      if (geocodeErr) {
        robot.logger.debug('Open-Meteo geocode failed, attempting fallback', geocodeErr);
        if (fallbackZipFromQuery) {
          getPollenForecast(fallbackZipFromQuery, msg);
          return;
        }

        if (geocodeErr.code === 'GEOCODE_NOT_FOUND') {
          sendFriendlyNoDataMessage(msg, locationQuery, null);
          return;
        }

        handleError(geocodeErr.message, msg);
        return;
      }

      const fallbackZip = extractFallbackZip(locationQuery, location);
      getOpenMeteoForecast(location, (openMeteoErr, forecast) => {
        if (!openMeteoErr) {
          const formattedMessage = formatOpenMeteoForecast(location, forecast);
          if (formattedMessage) {
            msg.send(formattedMessage);
            return;
          }
        }

        if (fallbackZip) {
          robot.logger.debug('Open-Meteo had no usable pollen data, falling back to Pollen.com', {
            fallbackZip,
          });
          getPollenForecast(fallbackZip, msg);
          return;
        }

        if (openMeteoErr) {
          handleError(openMeteoErr.message, msg);
          return;
        }

        sendFriendlyNoDataMessage(msg, locationQuery, location);
      });
    });
  };

  robot.respond(/pollen$/i, (msg) => getForecast(defaultZipCode, msg));

  robot.respond(/pollen (.+)$/i, (msg) => getForecast(msg.match[1], msg));

   
  require('./ollama-tools')(robot, {
    getOpenMeteoGeocode,
    getOpenMeteoForecast,
    getPollenForecastData,
    summarizeOpenMeteoPollen,
    buildOpenMeteoLocationLabel,
    extractFallbackZip,
    formatIndexLabel,
  });
};
