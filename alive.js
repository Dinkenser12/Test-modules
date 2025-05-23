export default function(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg?.message || msg.key.fromMe) return

    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    if (text.toLowerCase() === '.alive') {
      await sock.sendMessage(msg.key.remoteJid, {
        text: '*Nezuko is alive!* 💓\n\nMade with love by Zenox.',
        footer: 'Powered by Nezuko',
        buttons: [
          { buttonId: '.menu', buttonText: { displayText: '📋 Menu' }, type: 1 }
        ],
        headerType: 1
      }, { quoted: msg })
    }
  })
}
