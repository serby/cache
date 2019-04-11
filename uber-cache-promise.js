const EventEmitter = require('events').EventEmitter
const LRU = require('lru-cache')
const through = require('through2')
// V8 prefers predictable objects
class CachePacket {
  constructor(ttl, data) {
    if (ttl) {
      ttl += Date.now()
    } else ttl = null
    this.ttl = ttl
    this.data = data
  }
}

class UberCache extends EventEmitter {
  constructor(options) {
    super()
    this.cache = new LRU({
      maxAge: 1000 * 60 * 60,
      max: 5000,
      ...options
    })
  }

  async set(key, value, ttl) {
    // Don't handle undefined cache keys
    if (key === undefined) {
      throw new Error('Invalid key undefined')
    }

    try {
      const encoded = JSON.stringify(value)
      this.cache.set(key, new CachePacket(ttl, encoded))
    } catch (e) {
      throw new TypeError('Unable to encode data')
    }
    return this
  }

  setStream(key, ttl) {
    // if (value === undefined && callback === undefined) {
    //   value = []
    //   return (stream = through(function write(data) {
    //     value.push(data)
    //     this.queue(data)
    //   }).on(
    //     'end',
    //     function() {
    //       try {
    //         var encoded = JSON.stringify(value)
    //         this.cache.set(key, new CachePacket(ttl, encoded))
    //       } catch (e) {
    //         stream.emit('error', e)
    //       }
    //     }.bind(this)
    //   ))
    // }
  }

  async get(key) {
    let value
    const cachePacket = this.cache.get(key)

    if (typeof cachePacket === 'undefined') {
      this.emit('miss', key)
      return undefined
    }

    try {
      value = JSON.parse(cachePacket.data)
    } catch (err) {
      throw new Error('Malformed cache data found')
    }

    // If ttl has expired, delete
    if (cachePacket.ttl && cachePacket.ttl < Date.now()) {
      this.cache.del(key)
      this.emit('miss', key)
      this.emit('stale', key, value, cachePacket.ttl)
      value = undefined
    } else {
      this.emit('hit', key, value, cachePacket.ttl)
    }

    return value
  }

  async delete(key) {
    this.cache.del(key)
    this.emit('delete', key)
  }

  async clear() {
    this.cache.reset()
    this.emit('clear')
  }

  async count() {
    return this.cache.length
  }

  async size() {
    throw new Error('TBC')
    // return this.cache.length
  }

  async dump() {
    return this.cache.dump()
  }
}

module.exports = UberCache
