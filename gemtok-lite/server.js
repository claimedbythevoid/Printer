import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { WebcastPushConnection } from 'tiktok-live-connector'

const app = express()
const httpServer = createServer(app)
const io = new SocketIOServer(httpServer, { cors: { origin: '*' } })

app.use(express.static('public'))

const connectors = new Map()
function getConnector(username) {
  const key = username.toLowerCase()
  if (connectors.has(key)) return connectors.get(key)
  const conn = new WebcastPushConnection(key, {})
  connectors.set(key, conn)
  return conn
}

io.on('connection', socket => {
  socket.on('connectLive', async ({ username }) => {
    if (!username) return socket.emit('errorMsg', 'Username required')
    const conn = getConnector(username)

    if (!conn.__wired) {
      conn.__wired = true
      // broadcast useful events
      conn.on('chat', data => io.emit('chat', data))
      conn.on('gift', data => io.emit('gift', {
        giftName: data.giftName,
        repeatCount: data.repeatCount,
        uniqueId: data.uniqueId,
        nickname: data.nickname,
        profilePictureUrl: data.profilePictureUrl,
        diamondCount: data.diamondCount
      }))
      conn.on('like', data => io.emit('like', data))
      conn.on('member', data => io.emit('member', data))
      conn.on('error', err => io.emit('errorMsg', String(err)))
      conn.on('streamEnd', () => io.emit('liveEnded', { username }))
    }

    try {
      const state = await conn.connect()
      socket.emit('connected', { roomId: state.roomId, viewerCount: state.viewerCount })
    } catch (err) {
      socket.emit('errorMsg', String(err))
    }
  })
})

const PORT = process.env.PORT || 5173
httpServer.listen(PORT, () => {
  console.log('Server on http://localhost:' + PORT)
})
