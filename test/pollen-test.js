/* global describe beforeEach afterEach it */
/* eslint-disable func-names */
const Helper = require('hubot-test-helper');
const chai = require('chai');
const nock = require('nock');

const {
  expect,
} = chai;

const helper = new Helper([
  '../src/pollen.js',
]);

describe('hubot-pollen', () => {
  beforeEach(function () {
    process.env.HUBOT_LOG_LEVEL = 'error';
    process.env.HUBOT_POLLEN_ZIP = 37206;
    nock.disableNetConnect();
    this.room = helper.createRoom();
  });

  afterEach(function () {
    delete process.env.HUBOT_LOG_LEVEL;
    delete process.env.HUBOT_POLLEN_ZIP;
    nock.cleanAll();
    this.room.destroy();
  });

  it('responds to pollen forecast for default location', function (done) {
    nock('https://www.pollen.com')
      .get('/api/forecast/current/pollen/37206')
      .matchHeader('User-Agent', /Mozilla\/.*/)
      .matchHeader('Referer', 'https://www.pollen.com/forecast/current/pollen/37206')
      .replyWithFile(200, `${__dirname}/fixtures/37206.json`);

    const selfRoom = this.room;
    selfRoom.user.say('alice', '@hubot pollen');
    setTimeout(
      () => {
        try {
          expect(selfRoom.messages).to.eql([
            ['alice', '@hubot pollen'],
            ['hubot', 'Nashville, TN Pollen: 8.2 (Medium-High) - Alder, Juniper, Maple'],
          ]);
          done();
        } catch (err) {
          done(err);
        }
      },
      100,
    );
  });

  it('responds to pollen forecast for default location with no allergens listed', function (done) {
    nock('https://www.pollen.com')
      .get('/api/forecast/current/pollen/37206')
      .matchHeader('User-Agent', /Mozilla\/.*/)
      .matchHeader('Referer', 'https://www.pollen.com/forecast/current/pollen/37206')
      .replyWithFile(200, `${__dirname}/fixtures/37206-no-triggers.json`);

    const selfRoom = this.room;
    selfRoom.user.say('alice', '@hubot pollen');
    setTimeout(
      () => {
        try {
          expect(selfRoom.messages).to.eql([
            ['alice', '@hubot pollen'],
            ['hubot', 'Nashville, TN Pollen: 0.1 (Low) - The pollen season in the area has completed.'],
          ]);
          done();
        } catch (err) {
          done(err);
        }
      },
      100,
    );
  });

  it('responds to pollen forecast plus a zip code', function (done) {
    nock('https://www.pollen.com')
      .get('/api/forecast/current/pollen/90210')
      .matchHeader('User-Agent', /Mozilla\/.*/)
      .matchHeader('Referer', 'https://www.pollen.com/forecast/current/pollen/90210')
      .replyWithFile(200, `${__dirname}/fixtures/90210.json`);

    const selfRoom = this.room;
    selfRoom.user.say('alice', '@hubot pollen 90210');
    setTimeout(
      () => {
        try {
          expect(selfRoom.messages).to.eql([
            ['alice', '@hubot pollen 90210'],
            ['hubot', 'Beverly Hills, CA Pollen: 7.2 (Medium) - Alder, Juniper, Ash'],
          ]);
          done();
        } catch (err) {
          done(err);
        }
      },
      1000,
    );
  });

  it('responds to pollen forecast for a zip code with no results', function (done) {
    nock('https://www.pollen.com')
      .get('/api/forecast/current/pollen/99501')
      .matchHeader('User-Agent', /Mozilla\/.*/)
      .matchHeader('Referer', 'https://www.pollen.com/forecast/current/pollen/99501')
      .replyWithFile(200, `${__dirname}/fixtures/99501.json`);

    const selfRoom = this.room;
    selfRoom.user.say('alice', '@hubot pollen 99501');
    setTimeout(
      () => {
        try {
          expect(selfRoom.messages).to.eql([
            ['alice', '@hubot pollen 99501'],
            ['hubot', '99501 Pollen: No forecast available.'],
          ]);
          done();
        } catch (err) {
          done(err);
        }
      },
      100,
    );
  });

  it('handles a server error', function (done) {
    nock('https://www.pollen.com')
      .get('/api/forecast/current/pollen/37206')
      .matchHeader('User-Agent', /Mozilla\/.*/)
      .matchHeader('Referer', 'https://www.pollen.com/forecast/current/pollen/37206')
      .reply(500);

    const selfRoom = this.room;
    selfRoom.user.say('alice', '@hubot pollen');
    setTimeout(
      () => {
        try {
          expect(selfRoom.messages).to.eql([
            ['alice', '@hubot pollen'],
            ['hubot', 'Error retrieving forecast: Server responded with HTTP 500'],
          ]);
          done();
        } catch (err) {
          done(err);
        }
      },
      100,
    );
  });
});
