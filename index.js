import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys'
import { loadPlugins } from './lib/pluginLoader.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = process.env.PORT || 3000
const sessions = {}

app.get('/', (req, res) => {
  res.send(`<h2>🌸 Nezuko Bot by Zenox 🌸</h2><p>Use /pair/:sessionid to get a pairing code.</p>`)
})

app.get('/pair/:sessionId', async (req, res) => {
  const { sessionId } = req.params
  if (!sessionId) return res.status(400).send('Missing session ID')

  try {
    const authPath = path.join(__dirname, 'sessions', sessionId)
    if (!fs.existsSync(authPath)) fs.mkdirSync(authPath, { recursive: true })

    const { state, saveCreds } = await useMultiFileAuthState(authPath)
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
      logger: pino({ level: 'silent' }),
      browser: ['Nezuko', 'Chrome', '1.0.0']
    })

    sessions[sessionId] = { sock, saveCreds }

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, pairingCode } = update

      if (pairingCode) sessions[sessionId].pairingCode = pairingCode

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut
        console.log(`❌ Session ${sessionId} disconnected`)
        if (shouldReconnect) startBot(sessionId)
      } else if (connection === 'open') {
        console.log(`✅ Session ${sessionId} connected`)

        await sock.sendMessage(sock.user.id, {
          text: `🌸 *Welcome to Nezuko Bot!* 🌸\n\nHello! I'm your personal WhatsApp assistant, built by *Zenox*.\nChoose a command below to begin:`,
          footer: 'Powered by Nezuko',
          buttons: [
            { buttonId: '.menu', buttonText: { displayText: '📋 Menu' }, type: 1 },
            { buttonId: '.help', buttonText: { displayText: '❓ Help' }, type: 1 },
            { buttonId: '.alive', buttonText: { displayText: '💓 Alive' }, type: 1 }
          ],
          headerType: 1
        })
      }
    })

    loadPlugins(sock)

    res.send(`<h3>✅ Pairing code for session "${sessionId}" is ready!</h3><p>Check your terminal to scan or use this code: <b>${sessions[sessionId].pairingCode || 'Loading...'}</b></p>`)
  } catch (e) {
    console.error(e)
    res.status(500).send('Error initializing session.')
  }
})

app.listen(PORT, () => console.log(`✅ Nezuko Bot web server running on port ${PORT}`))

export async function startBot(sessionId = 'default') {
  const res = await fetch(`http://localhost:${PORT}/pair/${sessionId}`)
  console.log(await res.text())
}

if (process.env.RENDER) startBot('default')
