import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import { loadPlugins } from './lib/pluginLoader.js';
import './web.js';
import fs from 'fs';
import path from 'path';

const sessions = {}; // Store all active sessions

const startBot = async (sessionId) => {
  const sessionPath = `./sessions/${sessionId}`;
  if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
    },
    logger: pino({ level: 'silent' }),
    browser: ['Nezuko Bot', 'Chrome', '1.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, pairingCode } = update;

    // Store the pairing code in session data for the web interface
    if (pairingCode) {
      sessions[sessionId].pairingCode = pairingCode;
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(`❌ Session ${sessionId} disconnected`);
      if (shouldReconnect) startBot(sessionId);
    } else if (connection === 'open') {
      console.log(`✅ Session ${sessionId} connected`);

      // Send start message with buttons
      await sock.sendMessage(sock.user.id, {
        text: `🌸 *Welcome to Nezuko Bot!* 🌸\n\nHello! I'm your personal WhatsApp assistant, built by *Zenox*.\nChoose a command below to begin:`,
        footer: 'Powered by Nezuko',
        buttons: [
          { buttonId: '.menu', buttonText: { displayText: '📋 Menu' }, type: 1 },
          { buttonId: '.help', buttonText: { displayText: '❓ Help' }, type: 1 },
          { buttonId: '.alive', buttonText: { displayText: '💓 Alive' }, type: 1 },
        ],
        headerType: 1
      });
    }
  });

  // Handle incoming messages
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    for (const plugin of global.plugins) {
      try {
        await plugin(sock, msg);
      } catch (err) {
        console.error('❗ Plugin error:', err);
      }
    }
  });

  sessions[sessionId].sock = sock;
};

global.plugins = loadPlugins(path.resolve('./plugins'));
global.sessions = sessions;

export { startBot };
