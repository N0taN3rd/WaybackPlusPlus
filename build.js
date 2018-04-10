const path = require('path')
const archiver = require('archiver')
const fs = require('fs-extra')
const program = require('commander')

program
  .option('-b, --both', 'Package Chrome and FireFox extension')
  .option('-c, --chrome', 'Package Chrome extension')
  .option('-f, --firefox', 'Package FireFox extension')
  .parse(process.argv)

const chromeDistPath = path.join(__dirname, 'dist', 'chrome')
const chromePath = path.join(__dirname, 'chrome')
const chromeExtensionPath = path.join(chromeDistPath, 'Wayback++.zip')

const firefoxDistPath = path.join(__dirname, 'dist', 'firefox')
const firefoxPath = path.join(__dirname, 'firefox')
const firefoxExtensionPath = path.join(firefoxDistPath, 'Wayback++.zip')

function doZip (from, to) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(to)
    const archive = archiver('zip', {
      zlib: { level: 9 }
    })
    output.on('close', () => {
      if (to === chromeExtensionPath) {
        console.log(
          `Packaged Wayback++ for Chrome. Zip found at ${chromeExtensionPath}`
        )
      } else if (to === firefoxPath) {
        console.log(
          `Packaged Wayback++ for FireFox. Zip found at ${firefoxExtensionPath}`
        )
      } else {
        console.log(`Packaged Wayback++. Zip found at ${to}`)
      }
      resolve()
    })
    archive.on('error', error => {
      reject(error)
    })
    archive.pipe(output)
    archive.directory(from, false)
    archive.finalize()
  })
}

async function buildIt () {
  if (program.both) {
    await fs.ensureDir(chromeDistPath)
    await doZip(chromePath, chromeExtensionPath)
    await fs.ensureDir(firefoxDistPath)
    await doZip(firefoxPath, firefoxExtensionPath)
  } else {
    if (program.chrome) {
      await fs.ensureDir(chromeDistPath)
      await doZip(chromePath, chromeExtensionPath)
    }
    if (program.firefox) {
      await fs.ensureDir(firefoxDistPath)
      await doZip(firefoxPath, firefoxExtensionPath)
    }
  }
}

buildIt().catch(error => {
  console.error(error)
})
