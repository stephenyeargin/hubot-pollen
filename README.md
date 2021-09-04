# hubot-pollen

Retrieves the latest forecast from the Pollen.com API.

[![npm version](https://badge.fury.io/js/hubot-pollen.svg)](http://badge.fury.io/js/hubot-pollen) [![Build Status](https://app.travis-ci.com/stephenyeargin/hubot-pollen.png)](https://app.travis-ci.com/stephenyeargin/hubot-pollen)

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

Set the target location by provide a zip code. Defaults to Nashville, TN for demonstration purposes.

| Environment Variable  | Required? | Description                         |
| --------------------- | :-------: | ----------------------------------- |
| `HUBOT_POLLEN_ZIP`    | No        | The default zip code to query       |

## Sample Interaction

```
user1>> hubot pollen
hubot>> Nashville, TN Pollen: 8.2 (Medium-High) - Alder, Juniper, Maple
```

## NPM Module

https://www.npmjs.com/package/hubot-pollen
