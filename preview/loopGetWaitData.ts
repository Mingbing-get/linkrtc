import { CacheData } from '../vitePlugin/mockServer'
import { Response } from '.'

export default class LoopGetWaitData {
  private listenerMap: Map<string, ((data: any) => any)[]> = new Map()

  constructor(
    private name?: string,
    private duration: number = 1000,
  ) {}

  setName(name: string) {
    this.name = name
  }

  getName() {
    return this.name
  }

  start() {
    setInterval(async () => {
      if (!this.name) return

      const res = await fetch(`/mock/waitData?name=${this.name}`, {
        method: 'GET',
      })

      const data = (await res.json()) as Response<CacheData[]>

      if (data.code === 0) {
        data.data.forEach((item) => {
          const listeners = this.listenerMap.get(item.type)
          listeners?.forEach((fn) => fn(item.data))
        })
      }
    }, this.duration)
  }

  use<T extends CacheData['type']>(
    type: T,
    fn: (data: PickWithType<T>['data']) => void | Promise<void>,
  ) {
    this.listenerMap.set(type, [...(this.listenerMap.get(type) || []), fn])
  }
}

type PickWithType<T extends CacheData['type']> = CacheData extends infer R
  ? R extends { type: T }
    ? R
    : never
  : never
