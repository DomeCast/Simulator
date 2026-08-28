import { defineConfig } from 'vite'

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'Simulator'

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? `/${repoName}/` : '/',
})
