module.exports = async (sock, msg) => {
  const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
  if (text.toLowerCase() === '.ping') {
    await sock.sendMessage(msg.key.remoteJid, { text: 'Pong 🏓' }, { quoted: msg });
  }
};
