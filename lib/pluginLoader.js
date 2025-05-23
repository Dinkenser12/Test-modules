import fs from 'fs';
import path from 'path';

export const loadPlugins = (dirPath) => {
  const plugins = [];
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    if (file.endsWith('.js')) {
      const plugin = require(path.join(dirPath, file));
      plugins.push(plugin);
    }
  });
  return plugins;
};
