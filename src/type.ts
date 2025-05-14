type WithPromise<T> = T | Promise<T>

export interface ChannelOption<L extends string = string> {
  stream?: MediaStream
  dataChannel?: L[]
}

export type IceCandidateListener = (
  candidate: RTCIceCandidate,
) => WithPromise<void>

export type RoomIceCandidateListener = (
  id: string,
  candidate: RTCIceCandidate,
) => WithPromise<void>

export type DataListener<
  T extends any = any,
  C extends Record<string, any> = {},
> = (
  event: MessageEvent<T>,
  context: C,
  next: () => Promise<void>,
) => WithPromise<void>

export type RoomDataListener<
  T extends any = any,
  C extends Record<string, any> = {},
> = (
  event: MessageEvent<T>,
  context: C & { __id: string },
  next: () => Promise<void>,
) => WithPromise<void>

export type TrackListener = (event: RTCTrackEvent) => WithPromise<void>

export type RoomTrackListener = (
  id: string,
  event: RTCTrackEvent,
) => WithPromise<void>
