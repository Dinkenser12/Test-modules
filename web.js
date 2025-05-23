import express from 'express';
import { startBot } from './index.js';
import path from 'path';

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));
app.use(express.static(path.join(process.cwd(), 'public')));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.render('index', { pairingCode: null });
});

app.post('/pair', async (req, res) => {
  const sessionId = Date.now().toString();
  global.sessions[sessionId] = {};
  await startBot(sessionId);

  // Wait for pairing code to be generated
  const waitForPairingCode = () =>
    new Promise((resolve) => {
      const check = () => {
        if (global.sessions[sessionId].pairingCode) {
          resolve(global.sessions[sessionId].pairingCode);
        } else {
          setTimeout(check, 1000);
        }
      };
      check();
    });

  const pairingCode = await waitForPairingCode();
  res.render('index', { pairingCode });
});

app.listen(port, () => {
  console.log(`🌐 Nezuko Bot Web Interface running at http://localhost:${port}`);
});
