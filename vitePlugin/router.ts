import { Connect } from 'vite'

type NextHandleFunctionParams = Parameters<Connect.NextHandleFunction>

type RouteFn<
  B extends Record<string, any> = {},
  Q extends Record<string, any> = {},
> = (
  ctx: {
    body: B
    query: Q
  },
  req: NextHandleFunctionParams[0],
  res: NextHandleFunctionParams[1],
) => void | Promise<void>

export default class Router {
  private postRoutes: Map<string, RouteFn> = new Map()
  private getRoutes: Map<string, RouteFn> = new Map()

  constructor(private baseUrl?: string) {}

  async execute(
    req: NextHandleFunctionParams[0],
    res: NextHandleFunctionParams[1],
    next: NextHandleFunctionParams[2],
  ) {
    const url = (req.url || '/').split('?')[0]
    const method = (req.method || 'GET').toLocaleLowerCase()
    if (method === 'post') {
      const routeFn = this.postRoutes.get(url)
      if (routeFn) {
        const body = await this.parseBody(req)
        const query = this.parseQuery(req)
        await routeFn({ body, query }, req, res)
        return
      }
    }
    if (method === 'get') {
      const routeFn = this.getRoutes.get(url)
      if (routeFn) {
        const body = await this.parseBody(req)
        const query = this.parseQuery(req)
        await routeFn({ body, query }, req, res)
        return
      }
    }

    next()
  }

  post<B extends Record<string, any> = {}, Q extends Record<string, any> = {}>(
    path: string,
    fn: RouteFn<B, Q>,
  ) {
    this.postRoutes.set(this.joinBaseUrl(path), fn)
  }

  get<B extends Record<string, any> = {}, Q extends Record<string, any> = {}>(
    path: string,
    fn: RouteFn<B, Q>,
  ) {
    this.getRoutes.set(this.joinBaseUrl(path), fn)
  }

  private joinBaseUrl(path: string) {
    return this.baseUrl ? `${this.baseUrl}${path}` : path
  }

  private parseBody(req: NextHandleFunctionParams[0]) {
    return new Promise<any>((resolve) => {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk.toString()
      })
      req.on('end', () => {
        resolve(JSON.parse(body || '{}'))
      })
    })
  }

  private parseQuery(req: NextHandleFunctionParams[0]) {
    const url = (req.url || '/').split('?')[1] || ''
    const query: Record<string, string> = {}
    url.split('&').forEach((item) => {
      const [key, value] = item.split('=')
      query[key] = value
    })
    return query
  }
}
