const Cache = require('../cache')
const cache = new Cache()
let last = process.memoryUsage().rss
let current = process.memoryUsage().rss
let i = 0
let buf = ''

const outputMemory = i => {
  current = process.memoryUsage().rss
  console.log('%d - RSS: %d - %d', i, current, current - last)
  last = current
}

for (i = 0; i < 1024; i++) buf += 'X'

for (i = 0; i < 1024 * 1024; i++) {
  cache.set('key', buf + 1)
  outputMemory(i)
}
