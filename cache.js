const EventEmitter = require('events').EventEmitter
const LRU = require('lru-cache')
const sizeof = require('object-sizeof')
// const msgpack = require('msgpack5')()

const deepClone = obj => {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime())
  }

  if (obj instanceof Array) {
    return obj.reduce((arr, item, i) => {
      arr[i] = deepClone(item)
      return arr
    }, [])
  }

  if (obj instanceof Object) {
    return Object.keys(obj).reduce((newObj, key) => {
      newObj[key] = deepClone(obj[key])
      return newObj
    }, {})
  }
}

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

class Cache extends EventEmitter {
  constructor(options) {
    super()
    this.cache = new LRU({
      maxAge: 1000 * 60 * 60,
      max: 5000,
      ...options,
      length: (n, key) => sizeof(n.data)
    })
  }

  async set(key, value, ttl) {
    // Don't handle undefined cache keys
    if (key === undefined) {
      throw new Error('Invalid key undefined')
    }

    try {
      const clone = deepClone(value)
      const packet = new CachePacket(ttl, clone)
      this.cache.set(key, packet)
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
    value = deepClone(cachePacket.data)

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
    return this.cache.itemCount
  }

  async size() {
    return this.cache.length
  }

  async dump() {
    return this.cache.dump()
  }
}

module.exports = Cache
