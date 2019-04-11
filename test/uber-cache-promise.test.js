const UberCache = require('../uber-cache-promise')

require('./conformance-test')(
  'uber-cache-promise',
  options => new UberCache(options)
)
