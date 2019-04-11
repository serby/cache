const assert = require('assert')
// const Stream = require('stream').Stream
// const streamAssert = require('stream-assert')

const delay = ms =>
  new Promise(resolve => {
    setTimeout(resolve, ms)
  })

module.exports = (name, engineFactory) => {
  describe(name, () => {
    describe('#set()', () => {
      it('should not allow undefined key', async () => {
        const cache = engineFactory()
        try {
          await cache.set(undefined)
        } catch (e) {
          assert.strictEqual('Invalid key undefined', e.message)
        }
      })

      it('should allow primitives to be set', async () => {
        const cache = engineFactory()
        await cache.set('key', 'hello')
        const value = await cache.get('key', 'hello')
        assert.strictEqual(value, 'hello')
      })

      it('should treat keys with spaces and keys with _ differently', async () => {
        const cache = engineFactory()
        await cache.set('key key', 'hello one')
        await cache.set('key_key', 'hello two')
        assert.strictEqual(await cache.get('key key'), 'hello one')
        assert.strictEqual(await cache.get('key_key'), 'hello two')
      })

      it('should allow objects to be set', async () => {
        const cache = engineFactory()
        await cache.set('key', { a: 1 })
        assert.deepStrictEqual(await cache.get('key'), { a: 1 })
      })

      it('should not allow circular objects', async () => {
        const cache = engineFactory()
        const circular = []

        circular.push(circular)

        try {
          await cache.set('key', circular)
        } catch (e) {
          assert(e instanceof TypeError)
          assert.strictEqual(e.message, 'Unable to encode data')
        }

        const value = await cache.get('key')
        assert.strictEqual(value, undefined)
      })

      describe.skip('Streaming Interface', () => {
        it('should return a WriteStream without data or callback', () => {
          const cache = engineFactory()
          const cacheStream = cache.set('key')

          assert.ok(cacheStream instanceof Stream, 'should be a Stream')
        })

        it('should allow primitives to be sent to WriteStream', done => {
          const cache = engineFactory()
          const cacheStream = cache.set('key')

          cacheStream
            .pipe(
              streamAssert.first(data => {
                assert.strictEqual(data, 'hello')
              })
            )
            .pipe(
              streamAssert.second(data => {
                assert.strictEqual(data, 'world')
              })
            )
            .end(() => {
              cache.get('key', (err, data) => {
                assert.deepStrictEqual(data, ['hello', 'world'])
                done()
              })
            })

          cacheStream.write('hello')
          cacheStream.write('world')
          cacheStream.end()
        })

        it('should allow objects to set to WriteStream', done => {
          const cache = engineFactory()
          const cacheStream = cache.set('key')

          cacheStream
            .pipe(
              streamAssert.first(data => {
                assert.strictEqual(data, 'hello')
              })
            )
            .pipe(
              streamAssert.second(data => {
                assert.strictEqual(data, 'world')
              })
            )
            .end(() => {
              cache.get('key', (err, data) => {
                assert.deepStrictEqual(data, [{ a: 1 }, { b: 2 }])
                done()
              })
            })

          cacheStream.write({ a: 1 })
          cacheStream.write({ b: 2 })
          cacheStream.end()
        })

        it('should error if given circular objects', done => {
          const cache = engineFactory(),
            cacheStream = cache.set('key'),
            circular = []

          circular.push(circular)

          cacheStream.on('error', function(error) {
            assert.strictEqual(
              error.message,
              'Converting circular structure to JSON'
            )
            done()
          })

          cacheStream.write(circular)
          cacheStream.end()
        })
      })
    })

    describe('#get()', () => {
      it('should emit a "miss" event on cache misses', done => {
        const cache = engineFactory()

        cache.on('miss', key => {
          assert.strictEqual(key, 'undefined')
          done()
        })

        cache.get('undefined')
      })

      it('should return undefined on cache miss', async () => {
        const cache = engineFactory()
        const value = await cache.get('undefined')
        assert.strictEqual(value, undefined, 'value should be undefined')
      })

      it('should emit a "stale" on an expired cache', async done => {
        const cache = engineFactory()

        cache.on('stale', (key, value, expired) => {
          assert.strictEqual(key, 'abc')
          assert.strictEqual(value, 'hello')
          assert(expired < Date.now())
          done()
        })

        await cache.set('abc', 'hello', 30)
        await cache.get('abc')
        await delay(50)
        const value = await cache.get('abc')
        assert.strictEqual(value, undefined)
      })

      it('should return undefined for a key that has not been set', async () => {
        const cache = engineFactory()
        const value = await cache.get('test')
        assert.strictEqual(value, undefined)
      })

      it('should return value via promise', async () => {
        const cache = engineFactory()
        cache.set('test', 'hello')
        const value = await cache.get('test')
        assert.strictEqual(value, 'hello')
      })

      it('should emit a “hit” when data is in cache', async done => {
        const cache = engineFactory()
        cache.on('hit', key => {
          assert.strictEqual(key, 'test')
          done()
        })
        await cache.set('test', 'hello')
        await cache.get('test')
      })

      it('should not return a value for a key that has been deleted', async () => {
        const cache = engineFactory()
        await cache.set('test', 'hello')
        await cache.delete('test')
        const value = await cache.get('test')
        assert.strictEqual(value)
      })

      it('should return a value when within the TTL', async () => {
        const cache = engineFactory()
        await cache.set('test', 'hello', 1000)
        const value = await cache.get('test')
        assert.strictEqual(value, 'hello')
      })

      it('should not return value when TTL has been exceeded', async () => {
        const cache = engineFactory()
        await cache.set('test2', 'hello', 1)
        await delay(1000)
        const value = await cache.get('test2')
        assert.strictEqual(value, undefined)
      })
    })

    describe('#delete()', () => {
      it('should not error if key does not exist', () => {
        const cache = engineFactory()
        cache.delete('')
      })

      it('should reduce size of cache', async () => {
        const cache = engineFactory()
        await cache.set('a', 1)
        assert.strictEqual(await cache.count(), 1)
        await cache.delete('a')
        assert.strictEqual(await cache.count(), 0)
      })

      it('should emit a "delete" on delete', done => {
        const cache = engineFactory()

        cache.on('delete', key => {
          assert.strictEqual(key, 'jim')
          done()
        })

        cache.delete('jim')
      })
    })

    describe('#clear()', () => {
      it('should emit a "clear" on clear', done => {
        const cache = engineFactory()

        cache.once('clear', () => {
          done()
        })

        cache.clear()
      })

      it('should reduce the count down to zero', async () => {
        const cache = engineFactory()
        assert.strictEqual(await cache.count(), 0)
        await cache.set('a', 1)
        assert.strictEqual(await cache.count(), 1)
        await cache.set('b', 2)
        assert.strictEqual(await cache.count(), 2)
        await cache.clear()
        assert.strictEqual(await cache.count(), 0)
      })
    })

    describe('#count()', () => {
      it('should return 0 before anything has been added to the cache', async () => {
        const cache = engineFactory()
        assert.strictEqual(await cache.count(), 0)
      })

      it('should return 1 after something has been added to the cache', async () => {
        const cache = engineFactory()
        await cache.set('a', 1)
        assert.strictEqual(await cache.count(), 1)
      })

      it('should return 0 after clear', async () => {
        const cache = engineFactory()
        await cache.set('a', 1)
        await cache.set('b', 2)
        assert.strictEqual(await cache.count(), 2)
        await cache.clear()
        assert.strictEqual(await cache.count(), 0)
      })
    })

    describe('#size()', () => {
      it('should return 0 before anything has been added to the cache', async () => {
        const cache = engineFactory()
        assert.strictEqual(await cache.size(), 0)
      })

      it('should return 8 bytes after adding a number', async () => {
        const cache = engineFactory()
        await cache.set('a', 1)
        assert.strictEqual(await cache.size(), 8)
      })

      it('should return 0 after clear', async () => {
        const cache = engineFactory()
        await cache.set('a', 1)
        await cache.set('b', 2)
        assert.strictEqual(await cache.size(), 16)
        await cache.clear()
        assert.strictEqual(await cache.size(), 0)
      })
    })
  })
}
