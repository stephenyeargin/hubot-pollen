# hubot-pollen

Retrieves the latest forecast from the Pollen.com API.

See [`src/pollen.coffee`](src/pollen.coffee) for full documentation.

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

Your server:

```
export HUBOT_POLLEN_ZIP=37203
```

Heroku:

```
heroku config:set HUBOT_POLLEN_ZIP=37203
```

## Sample Interaction

```
user1>> hubot pollen
hubot>> Nashville, TN Pollen: 8.2 (Medium-High) - Alder, Juniper, Maple
```

## NPM Module

https://www.npmjs.com/package/hubot-pollen
