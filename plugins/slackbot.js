var log = require('../core/log');
var moment = require('moment');
var _ = require('lodash');
var config = require('../core/util').getConfig();
var slackbot = config.slackbot;
var utc = moment.utc;

var RtmClient = require('@slack/client').RtmClient;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;

var placeHolder = '__slack__';

var Actor = function() {
  _.bindAll(this);

  this.advice = 'Dont got one yet :(';
  this.adviceTime = utc();

  this.price = 'Dont know yet :(';
  this.priceTime = utc();

  this.commands = {
    placeHolder + ' advice': 'emitAdvice',
    placeHolder + ' price': 'emitPrice',
    placeHolder + ' donate': 'emitDonation',
    placeHolder + ' real advice': 'emitRealAdvice',
    placeHolder + ' help': 'emitHelp'
  };

  this.rawCommands = _.keys(this.commands);

  this.channel = null;
  this.info = {};
  this.bot = new RtmClient(slackbot.token);
  this.bot.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, this.startup);
  this.bot.on(CLIENT_EVENTS.RTM.AUTHENTICATED, this.authenticated);
  this.bot.on(RTM_EVENTS.MESSAGE, this.verifyQuestion);
  this.bot.start();
}

Actor.prototype.processCandle = function(candle, done) {
  this.price = candle.close;
  this.priceTime = candle.start;

  done();
};

Actor.prototype.processAdvice = function(advice) {
  if (slackbot.muteSoft && advice.recommendation === 'soft') return;
  this.advice = advice.recommendation;
  this.adviceTime = utc();

  if (slackbot.emitUpdates)
    this.newAdvice();
};

Actor.prototype.startup = function() {
  log.info('Slack: startup');
}

Actor.prototype.buildCommands = function() {
  var _self = this;
  _self.commands = _.reduce(Object.keys(_self.commands), function(result, command) {
    var key = command.replace(placeHolder, '<@' + _self.info.id + '>');
    result[key] = _self.commands[command];
    return result;
  }, {});
}

Actor.prototype.authenticated = function(rtmStartData) {
  this.info.id = rtmStartData.self.id;
  this.info.name = rtmStartData.self.name;
  this.buildCommands();
  for (const channel of rtmStartData.channels) {
    if (channel.is_member && channel.name === slackbot.channel) {
      this.channel = channel.id;
    }
  }
}

Actor.prototype.verifyQuestion = function(message) {
  if (message.text in this.commands)
    this[this.commands[message.text]]();
}

Actor.prototype.newAdvice = function() {
  this.bot.sendMessage('Guys! Important news!', this.channel);
  this.emitAdvice();
}

// sent advice to the last chat
Actor.prototype.emitAdvice = function() {
  var message = [
    'Advice for ',
    config.watch.exchange,
    ' ',
    config.watch.currency,
    '/',
    config.watch.asset,
    ' using ',
    config.tradingAdvisor.method,
    ' at ',
    config.tradingAdvisor.candleSize,
    ' minute candles, is:\n',
    this.advice,
    ' ',
    config.watch.asset,
    ' (from ',
      this.adviceTime.fromNow(),
    ')'
  ].join('');

  this.bot.sendMessage(message, this.channel);
};

// sent price over to the last chat
Actor.prototype.emitPrice = function() {
  var message = [
    'Current price at ',
    config.watch.exchange,
    ' ',
    config.watch.currency,
    '/',
    config.watch.asset,
    ' is ',
    this.price,
    ' ',
    config.watch.currency,
    ' (from ',
      this.priceTime.fromNow(),
    ')'
  ].join('');

  this.bot.sendMessage(message, this.channel);
};

// sent donation info over to the IRC channel
Actor.prototype.emitDonation = function() {
  var message = 'You want to donate? How nice of you! You can send your coins here:';
  message += '\nBTC:\t1C8vyMaFsD4tdnUKwMiPTt1DocBcPsEiC6';

  this.bot.sendMessage(message, this.channel);
};

Actor.prototype.emitHelp = function() {
  var _self = this;
  var message = _.reduce(
    _self.rawCommands,
    function(message, command) {
      return message + ' ' + command.replace(placeHolder, '@' + _self.info.name) + ',';
    },
    'possible commands are:'
  );

  message = message.substr(0, _.size(message) - 1) + '.';

  this.bot.sendMessage(message, this.channel);
}

Actor.prototype.emitRealAdvice = function() {
  // http://www.examiner.com/article/uncaged-a-look-at-the-top-10-quotes-of-gordon-gekko
  // http://elitedaily.com/money/memorable-gordon-gekko-quotes/
  var realAdvice = [
    'I don\'t throw darts at a board. I bet on sure things. Read Sun-tzu, The Art of War. Every battle is won before it is ever fought.',
    'Ever wonder why fund managers can\'t beat the S&P 500? \'Cause they\'re sheep, and sheep get slaughtered.',
    'If you\'re not inside, you\'re outside!',
    'The most valuable commodity I know of is information.',
    'It\'s not a question of enough, pal. It\'s a zero sum game, somebody wins, somebody loses. Money itself isn\'t lost or made, it\'s simply transferred from one perception to another.',
    'What\'s worth doing is worth doing for money. (Wait, wasn\'t I a free and open source bot?)',
    'When I get a hold of the son of a bitch who leaked this, I\'m gonna tear his eyeballs out and I\'m gonna suck his fucking skull.'
  ];

  this.bot.sendMessage(_.first(_.shuffle(realAdvice)), this.channel);
}

Actor.prototype.logError = function(message) {
  log.error('Slack ERROR:', message);
};

module.exports = Actor;

