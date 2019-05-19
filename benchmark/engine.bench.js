const count = 200000
module.exports = async (name, engineFactory) => {
  const populateCachePrimitiveData = async () => {
    const cache = engineFactory()
    for (let i = 0; i < count; i++) {
      await cache.set('key' + i, i)
    }
    return cache
  }

  const populateCacheComplexData = async () => {
    const cache = engineFactory()
    for (let i = 0; i < count; i++) {
      await cache.set('key' + i, { a: 'Hello', b: i })
    }
    return cache
  }

  const benches = {
    'cache.set() with object data': async () => populateCacheComplexData(),
    'cache.set() with primitive data': async () => populateCachePrimitiveData(),
    'cache.get() with empty cache': async start => {
      const cache = engineFactory()
      start()
      for (let i = 0; i < count; i++) {
        await cache.get('key' + i)
      }
    },
    'cache.get() with populated cache': async start => {
      const cache = await populateCachePrimitiveData()
      start()
      for (let i = 0; i < count; i++) {
        await cache.get('key' + i)
      }
    },
    'cache.get() with populated complex data cache': async start => {
      const cache = await populateCacheComplexData()
      start()
      for (let i = 0; i < count; i++) {
        await cache.get('key' + i)
      }
    },
    'cache.delete()': async start => {
      const cache = engineFactory()

      for (let i = 0; i < count; i++) {
        await cache.set('key' + i, i)
      }
      start()
      for (let i = 0; i < count; i++) {
        await cache.delete('key' + i, i)
      }
    }
  }

  console.log('Operation count: ' + count)
  const startTotalTime = process.hrtime()
  for (let bench in benches) {
    let startTime = process.hrtime()
    const start = () => (startTime = process.hrtime())
    await benches[bench](start)
    let endTime = process.hrtime(startTime)
    console.info(`%dms - ${bench}`, endTime[1] / 1000000)
  }
  const endTotalTime = process.hrtime(startTotalTime)
  console.info(`%dms - total`, endTotalTime[1] / 1000000)
}
