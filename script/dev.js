const express = require('express')
const { createServer: createViteServer } = require('vite')

async function createServer() {
  const app = express()

  // 以中间件模式创建 Vite 服务器
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
    // 不引入 Vite 默认的 HTML 处理中间件
  })
  // 将 vite 的 connect 实例作中间件使用
  app.use(vite.middlewares)

  app.use('*', async (req, res) => {
    // 由于 `appType` 的值是 `'custom'`，因此应在此处提供响应。
    // 请注意：如果 `appType` 值为 `'spa'` 或 `'mpa'`，Vite 会包含
    // 处理 HTML 请求和 404 的中间件，因此用户中间件应该在
    // Vite 的中间件之前添加，以确保其生效。
  })
}

createServer()
