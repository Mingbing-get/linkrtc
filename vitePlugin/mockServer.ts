import { PluginOption } from 'vite'
import Router from './router'

interface WaitOffer {
  type: 'offer'
  data: {
    from: string
    offer: RTCSessionDescriptionInit
  }
}

interface WaitAnswer {
  type: 'answer'
  data: {
    from: string
    answer: RTCSessionDescriptionInit
  }
}

interface WaitCandidate {
  type: 'candidate'
  data: {
    from: string
    candidate: RTCIceCandidate
  }
}

interface WaitLeave {
  type: 'leave'
  data: {
    from: string
  }
}

export type CacheData = WaitAnswer | WaitOffer | WaitCandidate | WaitLeave

export default function mockServer(): PluginOption {
  const router = new Router('/mock')
  const users: string[] = []
  const cacheData: Record<string, CacheData[]> = {}

  function addCacheData(userName: string, data: CacheData) {
    if (!cacheData[userName]) {
      cacheData[userName] = []
    }
    cacheData[userName].push(data)
  }

  function getCacheData(userName: string) {
    if (!cacheData[userName]?.length) return []

    const data = cacheData[userName]
    delete cacheData[userName]
    return data
  }

  router.post<{ name: string }>('/joinRoom', (ctx, req, res) => {
    const { name } = ctx.body

    if (!users.includes(name)) {
      users.push(name)
    }

    const otherUsers = users.filter((item) => item !== name)
    res.end(
      JSON.stringify({
        code: 0,
        msg: 'success',
        data: {
          otherUsers,
        },
      }),
    )
  })

  router.post<{ name: string }>('/leaveRoom', (ctx, req, res) => {
    const { name } = ctx.body
    users.splice(users.indexOf(name), 1)
    users.forEach((user) => {
      addCacheData(user, {
        type: 'leave',
        data: {
          from: name,
        },
      })
    })
    res.end(
      JSON.stringify({
        code: 0,
        msg: 'success',
      }),
    )
  })

  router.post<{
    from: string
    userWithOffer: { to: string; offer: RTCSessionDescriptionInit }[]
  }>('/publishOffer', (ctx, req, res) => {
    const { from, userWithOffer } = ctx.body
    userWithOffer.forEach((item) => {
      addCacheData(item.to, {
        type: 'offer',
        data: {
          from,
          offer: item.offer,
        },
      })
    })
    res.end(
      JSON.stringify({
        code: 0,
        msg: 'success',
      }),
    )
  })

  router.post<{ from: string; to: string; answer: RTCSessionDescriptionInit }>(
    '/publishAnswer',
    (ctx, req, res) => {
      const { from, to, answer } = ctx.body
      addCacheData(to, {
        type: 'answer',
        data: {
          from,
          answer,
        },
      })

      res.end(
        JSON.stringify({
          code: 0,
          msg: 'success',
        }),
      )
    },
  )

  router.post<{ from: string; to: string; candidate: RTCIceCandidate }>(
    '/publishIceCandidate',
    (ctx, req, res) => {
      const { from, to, candidate } = ctx.body
      addCacheData(to, {
        type: 'candidate',
        data: {
          from,
          candidate,
        },
      })

      res.end(
        JSON.stringify({
          code: 0,
          msg: 'success',
        }),
      )
    },
  )

  router.get<{}, { name: string }>('/waitData', (ctx, req, res) => {
    const { name } = ctx.query

    const data = getCacheData(name)
    res.end(
      JSON.stringify({
        code: 0,
        msg: 'success',
        data,
      }),
    )
  })

  return {
    name: 'mock-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => router.execute(req, res, next))
    },
  }
}
