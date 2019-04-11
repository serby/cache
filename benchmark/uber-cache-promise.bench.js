const UberCache = require('../uber-cache-promise')

require('./engine.bench')('memory-engine', options => new UberCache(options))
