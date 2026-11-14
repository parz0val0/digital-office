import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' 让 dist 可以放在任意子路径下（GitHub Pages / 静态服务器 / 子目录）
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1500 },
  server: { host: '0.0.0.0' },
})
