# hubot-pollen

Retrieves the latest pollen forecast using Open-Meteo first, with fallback to Pollen.com when Open-Meteo has no usable pollen data.

[![npm version](https://badge.fury.io/js/hubot-pollen.svg)](http://badge.fury.io/js/hubot-pollen) [![Node CI](https://github.com/stephenyeargin/hubot-pollen/actions/workflows/nodejs.yml/badge.svg)](https://github.com/stephenyeargin/hubot-pollen/actions/workflows/nodejs.yml)

## Installation

In hubot project repo, run:

`npm install hubot-pollen --save`

Then add **hubot-pollen** to your `external-scripts.json`:

```json
[
  "hubot-pollen"
]
```

## Configuration

Set the target location by providing a default search value (ZIP, city, or place text). Defaults to Nashville, TN for demonstration purposes.

| Environment Variable          | Required? | Description                                                    |
| ----------------------------- | :-------: | -------------------------------------------------------------- |
| `HUBOT_POLLEN_ZIP`            | No        | Default location query (ZIP, city, or place)                   |
| `HUBOT_POLLEN_OLLAMA_ENABLED` | No        | Set to `true` to register pollen tools with `hubot-ollama`     |

## Commands

- `hubot pollen` - Show today's pollen levels for the default location query.
- `hubot pollen <zip>` - Show today's pollen levels for the given 5-digit ZIP.
- `hubot pollen <search>` - Show today's pollen levels for a geocoded location query.

## Data Source Strategy

1. Query Open-Meteo geocoding with the provided location string.
2. Query Open-Meteo air-quality pollen endpoint by coordinate.
3. If Open-Meteo pollen values are all null (or otherwise unusable), fallback to Pollen.com using a 5-digit ZIP when available.

Open-Meteo pollen values are only available for Europe during pollen season, so fallback is expected for many US locales.
Slack responses cite Open-Meteo in the attachment footer when that data source is used.

## Sample Interaction

```
user1>> hubot pollen
hubot>> Nashville, TN Pollen: 8.2 (Medium-High) - Alder, Juniper, Maple

user1>> hubot pollen London
hubot>> London, GB Pollen: Low intensity (1.7 grains/m^3 peak) - Grass 1.7, Birch 0.6
```

## NPM Module

https://www.npmjs.com/package/hubot-pollen

## Ollama Integration

This package can expose pollen tools to [Ollama](https://ollama.ai/) for use in LLM-powered conversations through the [hubot-ollama](https://github.com/stephenyeargin/hubot-ollama) package.

### Enabling Ollama Tools

To enable this feature, set the following environment variable:

```bash
HUBOT_POLLEN_OLLAMA_ENABLED=true
```

This requires hubot-ollama to be installed in your hubot repository. If hubot-ollama is not available, the tools will not be registered but the package will continue to function normally.

### Available Tools

#### get_pollen_forecast

Retrieves pollen forecast data for a specified location.

Parameters:
- location (string, required): Location to get pollen forecast for. Can be a city name, city/state, city/country, or US ZIP code (for example, "Nashville, TN", "London", "37203").

Returns:
- Source used (open-meteo or pollen.com)
- Location label
- Coordinates when available
- Intensity and peak concentration
- Top pollen types when available

#### get_pollen_by_coordinates

Retrieves pollen forecast data for specific latitude and longitude coordinates.

Parameters:
- latitude (number, required): Latitude coordinate
- longitude (number, required): Longitude coordinate

Returns:
- Source used (open-meteo)
- Coordinates
- Intensity and peak concentration
- Top pollen types when available

### Example Tool Response Shapes

**`get_pollen_forecast`** — Open-Meteo result:
```json
{
  "source": "open-meteo",
  "location": "London, GB",
  "coordinates": { "latitude": 51.5, "longitude": -0.1 },
  "intensity": "Low",
  "peak_grains_per_m3": 1.7,
  "pollen_types": [
    { "type": "Grass", "peak": 1.7 },
    { "type": "Birch", "peak": 0.6 }
  ]
}
```

**`get_pollen_forecast`** — Pollen.com fallback result:
```json
{
  "source": "pollen.com",
  "location": "Nashville, TN",
  "zip": "37206",
  "index": 8.2,
  "level": "Medium-High",
  "triggers": ["Alder", "Juniper", "Maple"]
}
```

**`get_pollen_by_coordinates`** result:
```json
{
  "source": "open-meteo",
  "coordinates": { "latitude": 51.5, "longitude": -0.1 },
  "intensity": "Low",
  "peak_grains_per_m3": 1.7,
  "pollen_types": [
    { "type": "Grass", "peak": 1.7 }
  ]
}
```
