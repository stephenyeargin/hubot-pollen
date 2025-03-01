// Description
//   Retrieves the latest from the Pollen.com API
//
// Configuration:
//   HUBOT_POLLEN_ZIP - Default zip code of your desired location
//
// Commands:
//   hubot pollen - Retrieve your configured city's pollen forecast.
//   hubot pollen <zip code> - Retrieve another city's pollen forecast.
//
// Author:
//   stephenyeargin

const moment = require('moment');

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
    if (!forecast.Location.DisplayLocation) {
      return `${forecast.Location.ZIP} Pollen: No forecast available.`;
    }

    // Skip to only today's forecast
    const index = forecast.Location.periods[1].Index;

    // Allergens list
    const triggers = [];
    Object.keys(forecast.Location.periods[1].Triggers || {}).forEach((k) => {
      const row = forecast.Location.periods[1].Triggers[k];
      triggers.push(`${row.Name}`);
    });
    if (triggers.length === 0) {
      triggers.push('The pollen season in the area has completed.');
    }

    switch (robot.adapterName) {
      // Slack adapter
      case 'slack':
        payload = {
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
              ts: moment(forecast.ForecastDate).unix(),
            },
          ],
        };
        break;

      // IRC/etc. formatting
      default:
        payload = `${forecast.Location.DisplayLocation} Pollen: `;
        payload += `${index} (${formatIndexLabel(index)}) - `;
        payload += triggers.join(', ');
    }

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
          const forecast = JSON.parse(body);
          robot.logger.debug('forecast', forecast);
          msg.send(formatForecast(forecast));
        } catch (e) {
          handleError(e, msg);
        }
      });
  };

  robot.respond(/pollen$/i, (msg) => getPollenForecast(defaultZipCode, msg));

  robot.respond(/pollen ([0-9]{5})$/i, (msg) => getPollenForecast(msg.match[1], msg));
};
