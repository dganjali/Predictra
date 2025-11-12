const fs = require('fs').promises
const path = require('path')

async function copyDir(srcDir, destDir) {
  try {
    await fs.mkdir(destDir, { recursive: true })
    const entries = await fs.readdir(srcDir, { withFileTypes: true })
    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name)
      const destPath = path.join(destDir, entry.name)
      if (entry.isDirectory()) {
        await copyDir(srcPath, destPath)
      } else if (entry.isFile()) {
        await fs.copyFile(srcPath, destPath)
        console.log(`Copied ${srcPath} -> ${destPath}`)
      }
    }
  } catch (err) {
    console.error('Error copying images:', err)
    process.exitCode = 1
  }
}

const SRC = path.resolve(__dirname, '..', 'frontend', 'images')
const DEST = path.resolve(__dirname, '..', 'public', 'images')

copyDir(SRC, DEST).then(() => console.log('Images copy complete.'))
