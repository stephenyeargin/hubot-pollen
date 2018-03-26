Helper = require('hubot-test-helper')
chai = require 'chai'
nock = require 'nock'

expect = chai.expect

helper = new Helper [
  'adapters/slack.coffee',
  '../src/pollen.coffee'
]

describe 'hubot-pollen with slack adapter', ->
  beforeEach ->
    process.env.HUBOT_LOG_LEVEL='error'
    process.env.HUBOT_POLLEN_ZIP=37206
    nock.disableNetConnect()
    @room = helper.createRoom()

  afterEach ->
    delete process.env.HUBOT_LOG_LEVEL
    delete process.env.HUBOT_POLLEN_ZIP
    nock.cleanAll()
    @room.destroy()

  it 'responds to pollen forecast for default location', (done) ->
    nock('https://www.pollen.com')
      .get('/api/forecast/current/pollen/37206')
      .replyWithFile(200, __dirname + '/fixtures/37206.json')

    selfRoom = @room
    selfRoom.user.say('alice', '@hubot pollen')
    setTimeout(() ->
      try
        expect(selfRoom.messages).to.eql [
          ['alice', '@hubot pollen']
          [
            'hubot',
            {
              "attachments": [
                {
                  "author_icon": "https://www.pollen.com/Content/favicon/apple-touch-icon-72x72.png"
                  "author_link": "https://www.pollen.com/"
                  "author_name": "Pollen.com"
                  "color": "danger"
                  "fallback": "Nashville, TN Pollen: 8.2 (Medium-High) - Alder, Juniper, Maple"
                  "fields": [
                    {
                      "short": true
                      "title": "Level"
                      "value": "Medium-High"
                    }
                    {
                      "short": true
                      "title": "Count"
                      "value": 8.2
                    }
                    {
                      "short": false
                      "title": "Types"
                      "value": "Alder, Juniper, Maple"
                    }
                  ]
                  "footer": "Pollen.com"
                  "title": "Nashville, TN Pollen"
                  "title_link": "https://www.pollen.com/forecast/current/pollen/37206"
                  "ts": 1520827200
                }
              ]
            }

          ]
        ]
        done()
      catch err
        done err
      return
    , 1000)


  it 'responds to pollen forecast plus a zip code', (done) ->
    nock('https://www.pollen.com')
      .get('/api/forecast/current/pollen/90210')
      .replyWithFile(200, __dirname + '/fixtures/90210.json')

    selfRoom = @room
    selfRoom.user.say('alice', '@hubot pollen 90210')
    setTimeout(() ->
      try
        expect(selfRoom.messages).to.eql [
          ['alice', '@hubot pollen 90210']
          [
            'hubot',
            {
              "attachments": [
                {
                  "author_icon": "https://www.pollen.com/Content/favicon/apple-touch-icon-72x72.png"
                  "author_link": "https://www.pollen.com/"
                  "author_name": "Pollen.com"
                  "color": "warning"
                  "fallback": "Beverly Hills, CA Pollen: 7.2 (Medium) - Alder, Juniper, Ash"
                  "fields": [
                    {
                      "short": true
                      "title": "Level"
                      "value": "Medium"
                    }
                    {
                      "short": true
                      "title": "Count"
                      "value": 7.2
                    }
                    {
                      "short": false
                      "title": "Types"
                      "value": "Alder, Juniper, Ash"
                    }
                  ]
                  "footer": "Pollen.com"
                  "title": "Beverly Hills, CA Pollen"
                  "title_link": "https://www.pollen.com/forecast/current/pollen/90210"
                  "ts": 1520827200
                }
              ]
            }
          ]
        ]
        done()
      catch err
        done err
      return
    , 1000)

  it 'responds to pollen forecast for a zip code with no results', (done) ->
    nock('https://www.pollen.com')
      .get('/api/forecast/current/pollen/99501')
      .replyWithFile(200, __dirname + '/fixtures/99501.json')

    selfRoom = @room
    selfRoom.user.say('alice', '@hubot pollen 99501')
    setTimeout(() ->
      try
        expect(selfRoom.messages).to.eql [
          ['alice', '@hubot pollen 99501']
          ['hubot', '99501 Pollen: No forecast available.']
        ]
        done()
      catch err
        done err
      return
    , 1000)
