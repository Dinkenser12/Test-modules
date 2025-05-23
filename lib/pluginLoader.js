import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

export async function loadPlugins(sock) {
  const dirPath = path.resolve('./plugins')
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath)
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.js'))

  for (const file of files) {
    const pluginPath = pathToFileURL(path.join(dirPath, file)).href
    const plugin = await import(pluginPath)
    if (typeof plugin.default === 'function') {
      plugin.default(sock)
    }
  }
}
