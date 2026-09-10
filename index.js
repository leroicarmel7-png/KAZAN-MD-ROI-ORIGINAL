import pkg from "@whiskeysockets/baileys"
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = pkg
import { Boom } from "@hapi/boom"
import pino from "pino"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { botConfig } from "./config.js"
import http from "http"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let currentPairingCode = null
let currentSock = null

async function loadCommands() {
  const commands = new Map()
  const folders = ["group","download","tools","game"]
  for (const folder of folders) {
    const folderPath = path.join(__dirname, "commands", folder)
    if (!fs.existsSync(folderPath)) continue
    for (const file of fs.readdirSync(folderPath)) {
      if (!file.endsWith(".js")) continue
      const mod = await import(`./commands/${folder}/${file}`)
      const cmd = mod.default
      commands.set(cmd.name, cmd)
      if (cmd.alias) for (const a of cmd.alias) commands.set(a, cmd)
    }
  }
  return commands
}

async function start(customNumber) {
  const { state, saveCreds } = await useMultiFileAuthState("auth")
  const commands = await loadCommands()
  const { version } = await fetchLatestBaileysVersion()
  console.log(`[KAZAN] ${commands.size} commandes chargées | Owner: ${botConfig.ownerName}`)

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["KAZAN MD", "Chrome", "2.0"]
  })
  currentSock = sock

  if (!sock.authState.creds.registered) {
    await new Promise(resolve => setTimeout(resolve, 3000))
    const number = (customNumber || botConfig.ownerNumber).replace(/[^0-9]/g, "")
    const code = await sock.requestPairingCode(number)
    currentPairingCode = code
    console.log(`\n\n🔑 PAIRING CODE: ${code}\n\n`)
  }

  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error instanceof Boom ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut : true
      if (shouldReconnect) start()
    } else if (connection === "open") {
      currentPairingCode = null
      console.log("✅ KAZAN CONNECTÉ - /ROI†🌹ORIGINAL•🐦‍🔥KAZAN")
    }
  })

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0]
    if (!m.message || m.key.fromMe) return
    const from = m.key.remoteJid
    const isGroup = from.endsWith("@g.us")
    let body = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || ""
    if (!body.startsWith(botConfig.prefix)) return

    const args = body.slice(1).trim().split(/ +/)
    const cmdName = args.shift().toLowerCase()
    const command = commands.get(cmdName)
    if (!command) return

    let isAdmin = false, isBotAdmin = false, groupMetadata = null
    if (isGroup) {
      try {
        groupMetadata = await sock.groupMetadata(from)
        const participant = groupMetadata.participants.find(p => p.id === m.key.participant || p.id === m.key.remoteJid)
        const botParticipant = groupMetadata.participants.find(p => p.id === sock.user.id)
        isAdmin = participant?.admin !== undefined
        isBotAdmin = botParticipant?.admin !== undefined
      } catch {}
    }

    const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage
    if (quoted) {
      m.quoted = {
        message: quoted,
        isViewOnce: quoted.viewOnceMessageV2 || quoted.viewOnceMessage,
        participant: m.message.extendedTextMessage.contextInfo.participant
      }
    }
    m.reply = (text) => sock.sendMessage(from, { text }, { quoted: m })

    try {
      await command.execute(sock, m, args, { isAdmin, isBotAdmin, groupMetadata, from, isGroup })
    } catch (e) {
      console.error(e)
      m.reply("❌ Erreur: " + e.message)
    }
  })
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html" })
    res.end(`
      <html>
      <head><title>KAZAN MD - Pairing</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:40px;background:#111;color:#fff;">
        <h1>🔑 KAZAN MD</h1>
        <form method="POST" action="/pair">
          <input name="number" placeholder="Ex: 22891847613" style="padding:10px;width:250px;font-size:16px;" required />
          <button type="submit" style="padding:10px 20px;font-size:16px;">Obtenir le code</button>
        </form>
        ${currentPairingCode ? `<h2 style="color:#0f0;">Code: ${currentPairingCode}</h2>` : ""}
      </body>
      </html>
    `)
  } else if (req.method === "POST" && req.url === "/pair") {
    let body = ""
    req.on("data", chunk => body += chunk)
    req.on("end", async () => {
      const params = new URLSearchParams(body)
      const number = params.get("number")
      currentPairingCode = null
      await start(number)
      res.writeHead(302, { Location: "/" })
      res.end()
    })
  } else {
    res.end("KAZAN MD is running")
  }
})

server.listen(process.env.PORT || 3000)

start()
