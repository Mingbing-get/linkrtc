import BaseRTC from './base'
import {
  ChannelOption,
  RoomIceCandidateListener,
  RoomDataListener,
  RoomTrackListener,
} from './type'

export default class MeshRoomRTC<L extends string = string> {
  readonly baseRTCMap: Map<string, BaseRTC<L>> = new Map()
  readonly iceCandidateListeners: RoomIceCandidateListener[] = []
  readonly trackListeners: RoomTrackListener[] = []
  readonly dataChannelListeners = new Map<L, RoomDataListener<any, any>[]>()

  private iceCandidateCache = new Map<string, RTCIceCandidate[]>()

  constructor(private config?: RTCConfiguration) {}

  async startConnect(id: string, option: ChannelOption<L>) {
    const baseRTC = new BaseRTC<L>(this.config)
    this.handleListener(id, baseRTC)
    this.baseRTCMap.set(id, baseRTC)
    return await baseRTC.createOffer(option)
  }

  async acceptConnect(
    id: string,
    offer: RTCSessionDescriptionInit,
    stream?: MediaStream,
  ) {
    const baseRTC = new BaseRTC<L>(this.config)
    this.handleListener(id, baseRTC)
    this.baseRTCMap.set(id, baseRTC)
    const answer = await baseRTC.acceptOffer(offer, stream)
    this.checkIceCandidate(id)
    return answer
  }

  acceptAnswer(id: string, answer: RTCSessionDescriptionInit) {
    const baseRTC = this.baseRTCMap.get(id)
    if (!baseRTC) {
      throw new Error('baseRTC not found')
    }
    baseRTC.acceptAnswer(answer)
    this.checkIceCandidate(id)
  }

  acceptIceCandidate(id: string, candidate: RTCIceCandidate) {
    const baseRTC = this.baseRTCMap.get(id)
    if (!baseRTC) {
      const candidates = this.iceCandidateCache.get(id) || []
      candidates.push(candidate)
      this.iceCandidateCache.set(id, candidates)
      return
    }
    baseRTC.addIceCandidate(candidate)
  }

  leave() {
    this.baseRTCMap.forEach((baseRTC) => {
      baseRTC.peerConnection.close()
    })
    this.baseRTCMap.clear()
  }

  remove(id: string) {
    if (!this.baseRTCMap.has(id)) {
      return
    }

    const baseRTC = this.baseRTCMap.get(id)
    this.baseRTCMap.delete(id)
    baseRTC?.peerConnection.close()
  }

  send(id: string | string[] | undefined, label: L, data: string) {
    if (!id) {
      this.baseRTCMap.forEach((baseRTC) => {
        baseRTC.sendData(label, data)
      })
      return
    }

    if (Array.isArray(id)) {
      id.forEach((id) => {
        const baseRTC = this.baseRTCMap.get(id)
        if (!baseRTC) {
          console.error('baseRTC not found')
          return
        }
        baseRTC.sendData(label, data)
      })
      return
    }

    const baseRTC = this.baseRTCMap.get(id)
    if (!baseRTC) {
      console.error('baseRTC not found')
      return
    }
    baseRTC.sendData(label, data)
  }

  useData<T extends any = any, C extends Record<string, any> = {}>(
    label: L,
    fn: RoomDataListener<T, C>,
  ) {
    this.dataChannelListeners.set(label, [
      ...(this.dataChannelListeners.get(label) || []),
      fn,
    ])

    this.baseRTCMap.forEach((baseRTC, id) => {
      baseRTC.useData(
        label,
        async (event, context: C & { __id: string }, next) => {
          if (!context.__id) {
            context.__id = id
          }

          await fn(event, context, next)
        },
      )
    })

    return this
  }

  useCandidate(fn: RoomIceCandidateListener) {
    this.iceCandidateListeners.push(fn)

    this.baseRTCMap.forEach((baseRTC, id) => {
      baseRTC.useCandidate((candidate) => {
        fn(id, candidate)
      })
    })

    return this
  }

  useTrack(fn: RoomTrackListener) {
    this.trackListeners.push(fn)

    this.baseRTCMap.forEach((baseRTC, id) => {
      baseRTC.useTrack((track) => {
        fn(id, track)
      })
    })

    return this
  }

  private handleListener(id: string, baseRTC: BaseRTC<L>) {
    this.iceCandidateListeners.forEach((fn) => {
      baseRTC.useCandidate((candidate) => {
        fn(id, candidate)
      })
    })

    this.trackListeners.forEach((fn) => {
      baseRTC.useTrack((track) => {
        fn(id, track)
      })
    })

    this.dataChannelListeners.forEach((listeners, label) => {
      listeners.forEach((fn) => {
        baseRTC.useData(
          label,
          async (event, context: { __id: string }, next) => {
            if (!context.__id) {
              context.__id = id
            }
            await fn(event, context, next)
          },
        )
      })
    })

    baseRTC.useClose(() => {
      this.baseRTCMap.delete(id)
    })
  }

  private checkIceCandidate(id: string) {
    const candidates = this.iceCandidateCache.get(id)
    if (!candidates) return

    const baseRTC = this.baseRTCMap.get(id)
    if (!baseRTC) return

    candidates.forEach((candidate) => {
      baseRTC.addIceCandidate(candidate)
    })
    this.iceCandidateCache.delete(id)
  }
}
