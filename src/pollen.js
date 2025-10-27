// Description:
//   Retrieves the latest pollen forecast from Pollen.com
//
// Configuration:
//   HUBOT_POLLEN_ZIP  Default ZIP code to use when none is provided (e.g., 37203)
//
// Commands:
//   hubot pollen            - Show today's pollen levels for the default ZIP
//   hubot pollen <zip>      - Show today's pollen levels for the given 5-digit ZIP
//
// Author:
//   stephenyeargin

const dayjs = require('dayjs');

module.exports = (robot) => {
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

    if (robot.adapterName?.includes('slack')) {
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
                value: index,
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

  const getPollenForecast = (zip, msg) => {
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
          handleError(err, msg);
          return;
        }
        try {
          if (res.statusCode !== 200) {
            handleError(`Server responded with HTTP ${res.statusCode}`, msg);
            return;
          }

          let forecast;
          try {
            forecast = JSON.parse(body);
          } catch (parseError) {
            handleError(`Error parsing JSON response: ${parseError}`, msg);
            return;
          }

          robot.logger.debug('forecast', forecast);

          msg.send(formatForecast(forecast));
        } catch (e) {
          handleError(`Unexpected error: ${e.message}`, msg);
        }
      });
  };

  robot.respond(/pollen$/i, (msg) => getPollenForecast(defaultZipCode, msg));

  robot.respond(/pollen ([0-9]{5})$/i, (msg) => getPollenForecast(msg.match[1], msg));
};
