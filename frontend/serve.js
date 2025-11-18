const http = require('http')
const fs = require('fs')
const path = require('path')
const url = require('url')

const dist = path.join(__dirname, 'dist')
const port = process.env.PORT || 5173

function sendJSON(res, code, obj){
  const payload = JSON.stringify(obj)
  res.writeHead(code, { 'Content-Type': 'application/json' })
  res.end(payload)
}

function serveFile(res, filePath){
  fs.readFile(filePath, (err, data) => {
    if(err){
      res.writeHead(404)
      return res.end('Not found')
    }
    const ext = path.extname(filePath).toLowerCase()
    const map = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.json':'application/json' }
    const type = map[ext] || 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': type })
    res.end(data)
  })
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true)
  if(req.method === 'POST' && parsed.pathname === '/api/waitlist'){
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try{
        const json = JSON.parse(body || '{}')
        const email = (json.email || '').trim()
        if(!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){
          return sendJSON(res, 400, { error: 'Invalid email' })
        }
        const entry = { email, ts: new Date().toISOString() }
        const file = path.join(__dirname, 'waitlist-submissions.json')
        let arr = []
        if(fs.existsSync(file)){
          try{ arr = JSON.parse(fs.readFileSync(file, 'utf8') || '[]') }catch(e){ arr = [] }
        }
        arr.push(entry)
        fs.writeFileSync(file, JSON.stringify(arr, null, 2))
        return sendJSON(res, 200, { ok: true })
      }catch(err){
        return sendJSON(res, 500, { error: 'Invalid JSON' })
      }
    })
    return
  }

  // Serve static files from dist; fallback to index.html
  let pathname = parsed.pathname
  if(pathname === '/') pathname = '/index.html'
  const filePath = path.join(dist, decodeURIComponent(pathname))
  if(filePath.indexOf(dist) !== 0){ res.writeHead(403); return res.end('Forbidden') }
  fs.stat(filePath, (err, stat) => {
    if(!err && stat.isFile()) return serveFile(res, filePath)
    // fallback to index.html
    serveFile(res, path.join(dist, 'index.html'))
  })
})

server.listen(port, ()=>console.log(`Preview server listening on http://localhost:${port}`))
