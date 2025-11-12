const fs = require('fs').promises
const path = require('path')

async function copyDir(srcDir, destDir) {
  try {
    // if source doesn't exist, skip quietly
    try {
      await fs.access(srcDir)
    } catch (e) {
      console.warn(`Source directory missing, skipping: ${srcDir}`)
      return
    }

    await fs.mkdir(destDir, { recursive: true })
    const entries = await fs.readdir(srcDir, { withFileTypes: true })
    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name)
      const destPath = path.join(destDir, entry.name)

      // skip hidden/system files (like .DS_Store) and dotfiles
      if (entry.name.startsWith('.')) {
        // silently skip
        continue
      }

      if (entry.isDirectory()) {
        await copyDir(srcPath, destPath)
        continue
      }

      if (entry.isFile()) {
        try {
          // skip very large files (>5MB) to avoid bloating builds
          const stat = await fs.stat(srcPath)
          const MAX_BYTES = 5 * 1024 * 1024
          if (stat.size > MAX_BYTES) {
            console.warn(`Skipping large file ${srcPath} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`)
            continue
          }

          await fs.copyFile(srcPath, destPath)
          console.log(`Copied ${srcPath} -> ${destPath}`)
        } catch (err) {
          console.warn(`Failed to copy ${srcPath}:`, err && err.message ? err.message : err)
          // continue copying other files
        }
      }
    }
  } catch (err) {
    console.error('Error copying assets:', err)
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
