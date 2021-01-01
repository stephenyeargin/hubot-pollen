# Description
#   Retrieves the latest from the Pollen.com API
#
# Configuration:
#   HUBOT_POLLEN_ZIP - Default zip code of your desired location
#
# Commands:
#   hubot pollen - Retrieve your configured city's pollen forecast.
#   hubot pollen <zip code> - Retrieve another city's pollen forecast.
#
# Author:
#   stephenyeargin

moment = require 'moment'

module.exports = (robot) ->
  apiUrl = 'https://www.pollen.com/api/forecast/current/pollen'
  webUrl = 'https://www.pollen.com/forecast/current/pollen'
  userAgentString = 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:75.0) Gecko/20100101 Firefox/75.0'
  defaultZipCode = process.env.HUBOT_POLLEN_ZIP || 37203

  robot.respond /pollen$/i, (msg) ->
    getPollenForecast(defaultZipCode, msg)

  robot.respond /pollen ([0-9]{5})$/i, (msg) ->
    getPollenForecast(msg.match[1], msg)

  getPollenForecast = (zip, msg) ->
    robot.logger.debug 'zip', zip
    requestHeaders = {
      'User-Agent': userAgentString,
      referer: "#{webUrl}/#{zip}"
    }
    robot.http("#{apiUrl}/#{zip}")
      .headers(requestHeaders)
      .get() (err, res, body) ->
        if err
          handleError err, msg
          return
        forecast = JSON.parse(body)
        robot.logger.debug 'forecast', forecast
        msg.send formatForecast(forecast)

  formatForecast = (forecast) ->
    # Send default message if no forecast available
    unless forecast.Location.DisplayLocation || forecast.Location.periods.length = 0
      return "#{forecast.Location.ZIP} Pollen: No forecast available."

    # Skip to only today's forecast
    index = forecast.Location.periods[1].Index

    # Allergens list
    triggers = []
    for own _k, row of forecast.Location.periods[1].Triggers
      triggers.push("#{row.Name}")
    if triggers.length == 0
      triggers.push('The pollen season in the area has completed.')

    switch robot.adapterName

      # Slack adapter
      when 'slack'
        payload = {
          attachments: [
            {
              fallback: "#{forecast.Location.DisplayLocation} Pollen: #{index} (#{formatIndexLabel(index)}) - #{triggers.join(', ')}",
              title: "#{forecast.Location.DisplayLocation} Pollen",
              title_link: "https://www.pollen.com/forecast/current/pollen/#{forecast.Location.ZIP}",
              author_name: 'Pollen.com',
              author_link: "https://www.pollen.com/",
              author_icon: 'https://www.pollen.com/Content/favicon/apple-touch-icon-72x72.png',
              footer: 'Pollen.com',
              color: formatIndexColor(index),
              fields: [
                {
                  title: 'Level'
                  value: formatIndexLabel(index),
                  short: true
                },
                {
                  title: 'Count'
                  value: index,
                  short: true
                },
                {
                  title: 'Types',
                  value: triggers.join(', '),
                  short: false
                }
              ],
              ts: moment(forecast.ForecastDate).unix()
            }
          ]
        }

      # IRC/etc. formatting
      else
        payload = "#{forecast.Location.DisplayLocation} Pollen: "
        payload += "#{index} (#{formatIndexLabel(index)}) - "
        payload += triggers.join(', ')

    return payload

  formatIndexColor = (index) ->
    if (index.toFixed(1) <= 2.4)
      return 'good'
    if (index.toFixed(1) <= 4.8)
      return 'warning'
    if (index.toFixed(1) <= 7.2)
      return 'warning'
    if (index.toFixed(1) <= 9.6)
      return 'danger'
    if (index.toFixed(1) <= 12.0)
      return 'danger'
    return 'danger'

  formatIndexLabel = (index) ->
    if (index.toFixed(1) <= 2.4)
      return 'Low'
    if (index.toFixed(1) <= 4.8)
      return 'Medium-Low'
    if (index.toFixed(1) <= 7.2)
      return 'Medium'
    if (index.toFixed(1) <= 9.6)
      return 'Medium-High'
    if (index.toFixed(1) <= 12.0)
      return 'High'
    return 'Death by Pollen'

  handleError = (err, msg) ->
    robot.logger.error err
    msg.send "Error retrieving forecast: #{err}"
