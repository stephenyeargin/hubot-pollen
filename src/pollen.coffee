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

module.exports = (robot) ->
  apiUrl = 'https://www.pollen.com/api/forecast/current/pollen'
  defaultZipCode = process.env.HUBOT_POLLEN_ZIP || 37203

  robot.respond /pollen$/i, (msg) ->
    getPollenForecast(defaultZipCode, msg)

  robot.respond /pollen ([0-9]{5})$/i, (msg) ->
    getPollenForecast(msg.match[1], msg)

  getPollenForecast = (zip, msg) ->
    robot.logger.debug 'zip', zip
    robot.http("#{apiUrl}/#{zip}")
      .header('Referer', "#{apiUrl}/#{zip}")
      .get() (err, res, body) ->
        if err
          handleError err, msg
          return
        forecast = JSON.parse(body)
        robot.logger.debug 'forecast', forecast
        msg.send formatForecast(forecast)

  formatForecast = (forecast) ->
    if (forecast.Location.DisplayLocation)
      output = "#{forecast.Location.DisplayLocation} Pollen: "
    else
      output = "#{forecast.Location.ZIP} Pollen: "
    if forecast.Location.periods.length > 0
      index = forecast.Location.periods[1].Index
      formattedIndex = formatIndex(index)
      output += "#{index} (#{formattedIndex}) - "
      triggers = []
      for own _k, row of forecast.Location.periods[1].Triggers
        triggers.push("#{row.Name}")
      output += triggers.join(', ')
    else
      output += "No forecast available."
    return output

  formatIndex = (index) ->
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
    msg.send "Error retrieving forecast: #{err}"
