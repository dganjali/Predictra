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

// Copy multiple frontend static asset directories into public so both
// the static frontend files and the Next app reference the same assets.
const ASSET_DIRS = [
  { src: path.resolve(__dirname, '..', 'frontend', 'images'), dest: path.resolve(__dirname, '..', 'public', 'images') },
  { src: path.resolve(__dirname, '..', 'frontend', 'css'), dest: path.resolve(__dirname, '..', 'public', 'css') },
  { src: path.resolve(__dirname, '..', 'frontend', 'js'), dest: path.resolve(__dirname, '..', 'public', 'js') }
]

;(async () => {
  for (const d of ASSET_DIRS) {
    try {
      await copyDir(d.src, d.dest)
    } catch (err) {
      console.error(`Failed copying from ${d.src} -> ${d.dest}:`, err)
      process.exitCode = 1
    }
  }
  console.log('Static assets copy complete.')
})()
