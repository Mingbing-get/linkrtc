import LoopGetWaitData from './loopGetWaitData'
import { BaseRTC, MeshRoomRTC } from '../src'
;(() => {
  testBaseRTC()

  const title = document.createElement('h3')
  title.innerText = 'meshRoomRTC'
  document.body.appendChild(title)

  testMeshRoomRTC()
})()

function testBaseRTC() {
  const baseRTC = new BaseRTC<'test'>()
  const wrapper = document.createElement('div')

  baseRTC.useCandidate((candidate) => {
    console.log('candidate: ', JSON.stringify(candidate))
  })
  baseRTC.useData<string>('test', async (e, context, next) => {
    console.log('data channel: ', e.data)
  })

  // 发送按钮
  const startButton = document.createElement('button')
  startButton.innerText = '发起'
  startButton.addEventListener('click', async () => {
    const offer = await baseRTC.createOffer({
      dataChannel: ['test'],
    })

    console.log(JSON.stringify(offer))
  })
  wrapper.appendChild(startButton)

  // answer输入框
  const acceptAnswerInput = document.createElement('input')
  acceptAnswerInput.placeholder = '请输入answer'
  acceptAnswerInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      if (!acceptAnswerInput.value) {
        return
      }

      baseRTC.acceptAnswer(JSON.parse(acceptAnswerInput.value))
    }
  })
  wrapper.appendChild(acceptAnswerInput)

  wrapper.appendChild(document.createElement('hr'))

  // offer输入框
  const acceptOfferInput = document.createElement('input')
  acceptOfferInput.placeholder = '请输入offer'
  acceptOfferInput.addEventListener('keyup', async (e) => {
    if (e.key === 'Enter') {
      if (!acceptOfferInput.value) {
        return
      }

      const answer = await baseRTC.acceptOffer(
        JSON.parse(acceptOfferInput.value),
      )
      console.log(JSON.stringify(answer))
    }
  })
  wrapper.appendChild(acceptOfferInput)

  wrapper.appendChild(document.createElement('hr'))

  // ice candidate输入框
  const iceCandidateInput = document.createElement('input')
  iceCandidateInput.placeholder = '请输入ice candidate'
  iceCandidateInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      if (!iceCandidateInput.value) {
        return
      }
      baseRTC.peerConnection.addIceCandidate(
        JSON.parse(iceCandidateInput.value),
      )
    }
  })
  wrapper.appendChild(iceCandidateInput)

  wrapper.appendChild(document.createElement('hr'))

  // 发送输入框
  const sendInput = document.createElement('input')
  sendInput.placeholder = '请输入要发送的数据'
  sendInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      if (!sendInput.value) {
        return
      }
      baseRTC.dataChannelMap.get('test')?.send(sendInput.value)
    }
  })
  wrapper.appendChild(sendInput)

  document.body.appendChild(wrapper)
}

export interface Response<T> {
  code: number
  msg: string
  data: T
}
function testMeshRoomRTC() {
  const meshRoomRTC = new MeshRoomRTC<'test'>()
  const loopGetWaitData = new LoopGetWaitData()
  const streamMap = new Map<
    string,
    {
      stream: MediaStream
      video: HTMLVideoElement
    }
  >()

  let stream: MediaStream | undefined

  async function startStream() {
    if (stream) return

    stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    })

    const stopButton = document.getElementById('stop-button')
    if (!stopButton) return

    const video = document.createElement('video')
    video.srcObject = stream
    video.autoplay = true
    video.playsInline = true
    video.muted = true
    stopButton.parentNode?.insertBefore(video, stopButton)
  }

  meshRoomRTC.useData('test', (e, context, next) => {
    console.log(`data channel: from ${context.__id} data ${e.data}`)
  })

  meshRoomRTC.useCandidate(async (id, candidate) => {
    await fetch('/mock/publishIceCandidate', {
      method: 'POST',
      body: JSON.stringify({
        from: loopGetWaitData.getName(),
        to: id,
        candidate,
      }),
    })
  })

  meshRoomRTC.useTrack((id, event) => {
    let info = streamMap.get(id)

    if (!info) {
      const stream = new MediaStream()

      const video = document.createElement('video')
      video.srcObject = stream
      video.autoplay = true
      video.playsInline = true
      video.muted = true
      document.body.appendChild(video)

      info = {
        stream,
        video,
      }

      streamMap.set(id, info)
    }

    info.stream.addTrack(event.track)
  })

  loopGetWaitData.use('offer', async (data) => {
    await startStream()

    const answer = await meshRoomRTC.acceptConnect(
      data.from,
      data.offer,
      stream,
    )
    await fetch('/mock/publishAnswer', {
      method: 'POST',
      body: JSON.stringify({
        from: loopGetWaitData.getName(),
        to: data.from,
        answer,
      }),
    })
  })

  loopGetWaitData.use('answer', (data) => {
    meshRoomRTC.acceptAnswer(data.from, data.answer)
  })

  loopGetWaitData.use('candidate', (data) => {
    meshRoomRTC.acceptIceCandidate(data.from, data.candidate)
  })

  loopGetWaitData.use('leave', (data) => {
    meshRoomRTC.remove(data.from)
    const info = streamMap.get(data.from)
    if (info) {
      streamMap.delete(data.from)
      info.stream.getTracks().forEach((track) => track.stop())
      info.video.remove()
    }
  })

  loopGetWaitData.start()

  const wrapper = document.createElement('div')

  // 停止录像按钮
  const stopButton = document.createElement('button')
  stopButton.innerText = '停止'
  stopButton.id = 'stop-button'
  stopButton.addEventListener('click', () => {
    const video = stopButton.previousSibling
    if (video?.nodeName === 'VIDEO') {
      video.remove()
    }

    if (!stream) return

    stream.getTracks().forEach((track) => track.stop())
    stream = undefined
  })
  wrapper.appendChild(stopButton)

  wrapper.appendChild(document.createElement('hr'))

  // 名字输入框和离开按钮
  const nameInput = document.createElement('input')
  nameInput.placeholder = '请输入你的名字'
  nameInput.addEventListener('keyup', async (e) => {
    if (e.key === 'Enter') {
      if (!nameInput.value) {
        return
      }

      loopGetWaitData.setName(nameInput.value)
      nameInput.disabled = true

      const res = await fetch('/mock/joinRoom', {
        method: 'POST',
        body: JSON.stringify({
          name: nameInput.value,
        }),
      })

      const data = (await res.json()) as Response<{
        otherUsers: string[]
      }>
      if (data.code !== 0 || data.data.otherUsers.length === 0) return

      await startStream()

      const userWithOffer: {
        to: string
        offer: RTCSessionDescriptionInit
      }[] = []

      for (const userName of data.data.otherUsers) {
        const offer = await meshRoomRTC.startConnect(userName, {
          dataChannel: ['test'],
          stream,
        })
        userWithOffer.push({
          to: userName,
          offer,
        })
      }

      await fetch('/mock/publishOffer', {
        method: 'POST',
        body: JSON.stringify({
          from: nameInput.value,
          userWithOffer,
        }),
      })
    }
  })
  wrapper.appendChild(nameInput)

  const leaveButton = document.createElement('button')
  leaveButton.innerText = '离开'
  leaveButton.addEventListener('click', async () => {
    await fetch('/mock/leaveRoom', {
      method: 'POST',
      body: JSON.stringify({
        name: nameInput.value,
      }),
    })
    meshRoomRTC.leave()
    nameInput.disabled = false

    const video = stopButton.previousSibling
    if (video?.nodeName === 'VIDEO') {
      video.remove()
    }

    streamMap.forEach((info) => {
      info.stream.getTracks().forEach((track) => track.stop())
      info.video.remove()
    })
    streamMap.clear()

    if (!stream) return

    stream.getTracks().forEach((track) => track.stop())
    stream = undefined
  })
  wrapper.appendChild(leaveButton)

  wrapper.appendChild(document.createElement('hr'))

  // 发送输入框
  const sendInput = document.createElement('input')
  sendInput.placeholder = '请输入要发送的数据'
  sendInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      if (!sendInput.value) {
        return
      }
      meshRoomRTC.send(undefined, 'test', sendInput.value)
    }
  })
  wrapper.appendChild(sendInput)

  document.body.appendChild(wrapper)
}
