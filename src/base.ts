import {
  IceCandidateListener,
  DataListener,
  ChannelOption,
  TrackListener,
} from './type'

export default class BaseRTC<L extends string = string> {
  static GoogleStunServer: RTCIceServer[] = [
    {
      urls: 'stun:stun.l.google.com:19302',
    },
    {
      urls: 'stun:stun1.l.google.com:19302',
    },
    {
      urls: 'stun:stun2.l.google.com:19302',
    },
    {
      urls: 'stun:stun3.l.google.com:19302',
    },
  ]

  readonly peerConnection: RTCPeerConnection
  readonly dataChannelMap = new Map<L, RTCDataChannel>()
  readonly iceCandidateListeners: IceCandidateListener[] = []
  readonly closeListeners: (() => void)[] = []
  readonly dataChannelListeners = new Map<L, DataListener<any, any>[]>()
  readonly trackListeners: TrackListener[] = []

  constructor(config?: RTCConfiguration) {
    this.peerConnection = new RTCPeerConnection(config)

    this.peerConnection.ondatachannel = (event) => {
      const { channel } = event
      this.dataChannelMap.set(channel.label as L, channel)
      this.handleDataChannel(channel)
    }

    this.peerConnection.onicecandidate = (event) => {
      const { candidate } = event
      if (candidate) {
        this.iceCandidateListeners.forEach((fn) => fn(candidate))
      }
    }

    this.peerConnection.onconnectionstatechange = () => {
      if (
        this.peerConnection.connectionState === 'closed' ||
        this.peerConnection.connectionState === 'disconnected'
      ) {
        this.closeListeners.forEach((fn) => fn())
      }
    }

    this.peerConnection.ontrack = (event) => {
      this.trackListeners.forEach((fn) => fn(event))
    }
  }

  async createOffer({ stream, dataChannel }: ChannelOption<L>) {
    if (stream) {
      stream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, stream)
      })
    }

    dataChannel?.forEach((channel) => {
      const dataChannel = this.peerConnection.createDataChannel(channel)
      this.dataChannelMap.set(channel, dataChannel)
      this.handleDataChannel(dataChannel)
    })

    const offer = await this.peerConnection.createOffer()
    await this.peerConnection.setLocalDescription(offer)
    return offer
  }

  async acceptOffer(offer: RTCSessionDescriptionInit, stream?: MediaStream) {
    if (stream) {
      stream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, stream)
      })
    }

    await this.peerConnection.setRemoteDescription(offer)
    const answer = await this.peerConnection.createAnswer()
    await this.peerConnection.setLocalDescription(answer)
    return answer
  }

  acceptAnswer(answer: RTCSessionDescriptionInit) {
    this.peerConnection.setRemoteDescription(answer)
  }

  useData<T extends any = any, C extends Record<string, any> = {}>(
    label: L,
    fn: DataListener<T, C>,
  ) {
    this.dataChannelListeners.set(label, [
      ...(this.dataChannelListeners.get(label) ?? []),
      fn,
    ])

    return this
  }

  useCandidate(fn: IceCandidateListener) {
    this.iceCandidateListeners.push(fn)

    return this
  }

  useClose(fn: () => void) {
    this.closeListeners.push(fn)

    return this
  }

  useTrack(fn: TrackListener) {
    this.trackListeners.push(fn)

    return this
  }

  sendData(label: L, data: string | Blob | ArrayBuffer | ArrayBufferView) {
    const channel = this.dataChannelMap.get(label)
    if (!channel || channel.readyState !== 'open') {
      console.error(`channel ${label} is not ready`)
      return
    }

    channel.send(data as any)
  }

  addIceCandidate(candidate: RTCIceCandidate) {
    this.peerConnection.addIceCandidate(candidate)

    return this
  }

  private handleDataChannel(channel: RTCDataChannel) {
    channel.onmessage = async (event) => {
      const dataListeners =
        this.dataChannelListeners.get(channel.label as L) || []
      const context = {} as any
      function createNext(index: number) {
        let execute = false
        return async () => {
          if (execute) return
          execute = true

          const nextFn = dataListeners[index + 1]
          if (!nextFn) return

          await nextFn(event, context, createNext(index + 1))
        }
      }

      const firstFn = dataListeners[0]
      if (firstFn) {
        await firstFn(event, context, createNext(0))
      }
    }

    channel.onclose = () => {
      this.dataChannelMap.delete(channel.label as L)
    }
  }
}
