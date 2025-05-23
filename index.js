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

app.get('/', (req, res) => {
  const session = sessions['default']
  const code = session?.pairingCode || 'Waiting...'
  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Nezuko Bot Pairing</title>
    <style>
      body {
        margin: 0;
        font-family: 'Poppins', sans-serif;
        background: linear-gradient(to bottom right, #fff0f6, #ffe0ec);
        color: #ff2d55;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        text-align: center;
      }
      h1 {
        font-family: 'Playfair Display', serif;
        font-size: 2.5rem;
        margin-bottom: 1rem;
      }
      .pair-code {
        font-size: 1.8rem;
        background: #fff;
        padding: 1rem 2rem;
        border-radius: 12px;
        box-shadow: 0 0 10px rgba(255, 45, 85, 0.3);
        margin: 1rem 0;
      }
      footer {
        position: absolute;
        bottom: 10px;
        font-size: 0.9rem;
        color: #888;
      }
    </style>
  </head>
  <body>
    <h1>🤖 Nezuko Bot Pairing</h1>
    <div class="pair-code">${code}</div>
    <p>Open WhatsApp → Settings → Linked Devices → Enter this pairing code.</p>
    <footer>Zenox Inc. 2025</footer>
  </body>
  </html>
  `
  res.send(html)
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
  } catch (e) {
    console.error('Failed to start bot:', e)
  }
}

app.listen(PORT, () => {
  console.log(`✅ Nezuko Bot web server running on port ${PORT}`)
  startBot('default')
})
