
import pkg from "@whiskeysockets/baileys"
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = pkg
import { Boom } from "@hapi/boom"
import pino from "pino"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { botConfig } from "./config.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("auth")
  const commands = await loadCommands()
  console.log(`[KAZAN] ${commands.size} commandes chargées | Owner: ${botConfig.ownerName}`)

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: true,
    browser: ["KAZAN MD", "Chrome", "2.0"]
  })

  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error instanceof Boom ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut : true
      if (shouldReconnect) start()
    } else if (connection === "open") {
      console.log("✅ KAZAN CONNECTÉ - ༼ 𝐑Ø𝐈༽ †🌹ᴼᴿᴵᴳᴵᴺᴬᴸ•🐦‍🔥𝐊𝐀𝐙𝐀𝐍")
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

    // Group metadata for admin checks
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

    // quoted helper for VV
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

start()
