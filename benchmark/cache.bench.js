const Cache = require('../cache')

require('./engine.bench')('memory-engine', options => new Cache(options))
