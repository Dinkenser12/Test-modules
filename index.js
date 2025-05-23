import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
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

app.use(express.static(path.join(__dirname, 'public')))

app.get('/get-code', (req, res) => {
  const session = sessions['default']
  const code = session?.pairingCode || null
  res.json({ code })
})

async function startBot(sessionId = 'default') {
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
        console.log(`âŒ Session ${sessionId} disconnected`)
        if (shouldReconnect) startBot(sessionId)
      } else if (connection === 'open') {
        console.log(`âœ… Session ${sessionId} connected`)
        await sock.sendMessage(sock.user.id, {
          text: `ðŸŒ¸ *Welcome to Nezuko Bot!* ðŸŒ¸\n\nHello! I'm your personal WhatsApp assistant, built by *Zenox*.\nChoose a command below to begin:`,
          footer: 'Powered by Nezuko',
          buttons: [
            { buttonId: '.menu', buttonText: { displayText: 'ðŸ“‹ Menu' }, type: 1 },
            { buttonId: '.help', buttonText: { displayText: 'â“ Help' }, type: 1 },
            { buttonId: '.alive', buttonText: { displayText: 'ðŸ’“ Alive' }, type: 1 }
          ],
          headerType: 1
        })
      }
    })

    loadPlugins(sock)
  } catch (e) {
    console.error('Failed to start bot:', e)
  }
}

app.listen(PORT, () => {
  console.log(`âœ… Nezuko Bot web server running on port ${PORT}`)
  startBot('default')
})
