import { defineConfig } from 'vite'
import { resolve } from 'path'
import mockServer from './vitePlugin/mockServer'

export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {
      root: resolve(process.cwd(), 'preview'),
      plugins: [mockServer()],
    }
  }

  return {}
})
