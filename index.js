import pkg from "@whiskeysockets/baileys"

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} = pkg

import { Boom } from "@hapi/boom"
import pino from "pino"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { botConfig } from "./config.js"
import http from "http"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let currentSock = null
let currentPairingCode = null
let pairingInProgress = false
let reconnecting = false

function cleanNumber(number) {
  return String(number || "").replace(/[^0-9]/g, "")
}

async function loadCommands() {
  const commands = new Map()
  const folders = ["group", "download", "tools", "game"]

  for (const folder of folders) {
    const folderPath = path.join(__dirname, "commands", folder)

    if (!fs.existsSync(folderPath)) continue

    for (const file of fs.readdirSync(folderPath)) {
      if (!file.endsWith(".js")) continue

      try {
        const mod = await import(`./commands/${folder}/${file}`)
        const cmd = mod.default

        if (!cmd || !cmd.name) continue

        commands.set(cmd.name, cmd)

        if (cmd.alias) {
          for (const alias of cmd.alias) {
            commands.set(alias, cmd)
          }
        }
      } catch (error) {
        console.error(
          `[𝐋Ξ𝐑Ø𝐈-MD] Impossible de charger ${folder}/${file}:`,
          error
        )
      }
    }
  }

  return commands
}

async function start() {
  if (currentSock) {
    console.log("[𝐋Ξ𝐑Ø𝐈-MD] Une connexion existe déjà.")
    return currentSock
  }

  const { state, saveCreds } =
    await useMultiFileAuthState("auth")

  const commands = await loadCommands()

  const { version } =
    await fetchLatestBaileysVersion()

  console.log(
    `[𝐋Ξ𝐑Ø𝐈-MD] ${commands.size} commandes chargées | Owner: ${botConfig.ownerName}`
  )

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),

    printQRInTerminal: false,

    browser: Browsers.ubuntu("Chrome"),

    connectTimeoutMs: 60000,

    defaultQueryTimeoutMs: 60000,

    markOnlineOnConnect: false
  })

  currentSock = sock

  sock.ev.on("creds.update", saveCreds)

  /*
   * CONNEXION
   */
  sock.ev.on(
    "connection.update",
    async ({ connection, lastDisconnect }) => {

      if (connection === "open") {
        reconnecting = false
        currentPairingCode = null
        pairingInProgress = false

        console.log(
          "✅ 𝐋Ξ𝐑Ø𝐈-MD CONNECTÉ - /ROI†🌹ORIGINAL•🐦‍🔥KAZAN"
        )

        return
      }

      if (connection === "close") {

        const statusCode =
          lastDisconnect?.error instanceof Boom
            ? lastDisconnect.error.output?.statusCode
            : undefined

        console.log(
          `[𝐋Ξ𝐑Ø𝐈-MD] Connexion fermée. Code: ${
            statusCode || "inconnu"
          }`
        )

        currentSock = null
        pairingInProgress = false
        currentPairingCode = null

        if (
          statusCode === DisconnectReason.loggedOut
        ) {
          console.log(
            "❌ Session déconnectée. Supprime le dossier auth avant de refaire un jumelage."
          )

          return
        }

        if (!reconnecting) {

          reconnecting = true

          setTimeout(() => {

            start().catch(error => {

              console.error(
                "[𝐋Ξ𝐑Ø𝐈-MD] Erreur reconnexion:",
                error
              )

              reconnecting = false

            })

          }, 5000)
        }
      }
    }
  )

  /*
   * MESSAGES
   */
  sock.ev.on(
    "messages.upsert",
    async ({ messages }) => {

      try {

        const m = messages[0]

        if (
          !m ||
          !m.message ||
          m.key.fromMe
        ) return

        const from = m.key.remoteJid

        if (!from) return

        const isGroup =
          from.endsWith("@g.us")

        const body =
          m.message.conversation ||
          m.message.extendedTextMessage?.text ||
          m.message.imageMessage?.caption ||
          ""

        if (
          !body.startsWith(
            botConfig.prefix
          )
        ) return

        const args = body
          .slice(
            botConfig.prefix.length
          )
          .trim()
          .split(/\s+/)

        const cmdName =
          args.shift()?.toLowerCase()

        if (!cmdName) return

        const command =
          commands.get(cmdName)

        if (!command) return

        let isAdmin = false
        let isBotAdmin = false
        let groupMetadata = null

        if (isGroup) {

          try {

            groupMetadata =
              await sock.groupMetadata(
                from
              )

            const sender =
              m.key.participant ||
              m.key.remoteJid

            const participant =
              groupMetadata.participants.find(
                p => p.id === sender
              )

            const botId =
              sock.user?.id

            const botParticipant =
              groupMetadata.participants.find(
                p => p.id === botId
              )

            isAdmin =
              participant?.admin !== undefined

            isBotAdmin =
              botParticipant?.admin !== undefined

          } catch (error) {

            console.error(
              "[𝐋Ξ𝐑Ø𝐈-MD] Erreur metadata groupe:",
              error
            )
          }
        }

        /*
         * MESSAGE CITÉ
         */
        const quoted =
          m.message
            .extendedTextMessage
            ?.contextInfo
            ?.quotedMessage

        if (quoted) {

          m.quoted = {

            message: quoted,

            isViewOnce:
              quoted.viewOnceMessageV2 ||
              quoted.viewOnceMessage,

            participant:
              m.message
                .extendedTextMessage
                ?.contextInfo
                ?.participant
          }
        }

        /*
         * RÉPONSE
         */
        m.reply = text =>
          sock.sendMessage(
            from,
            { text },
            { quoted: m }
          )

        /*
         * EXÉCUTION
         */
        try {

          await command.execute(
            sock,
            m,
            args,
            {
              isAdmin,
              isBotAdmin,
              groupMetadata,
              from,
              isGroup
            }
          )

        } catch (error) {

          console.error(
            `[𝐋Ξ𝐑Ø𝐈-MD] Erreur commande ${cmdName}:`,
            error
          )

          try {

            await m.reply(
              "❌ Erreur: " +
              (
                error?.message ||
                "Erreur inconnue"
              )
            )

          } catch {}
        }

      } catch (error) {

        console.error(
          "[𝐋Ξ𝐑Ø𝐈-MD] Erreur message:",
          error
        )
      }
    }
  )

  /*
   * DEMANDE DE CODE DE JUMELAGE
   */
  if (!state.creds.registered) {

    const number = cleanNumber(
      process.env.PHONE_NUMBER ||
      botConfig.ownerNumber
    )

    if (!number) {

      console.error(
        "❌ Aucun numéro configuré."
      )

      return sock
    }

    console.log(
      `📱 NUMÉRO UTILISÉ: ${number}`
    )

    /*
     * Attente avant demande du code
     */
    await new Promise(
      resolve =>
        setTimeout(resolve, 5000)
    )

    if (
      !sock.authState.creds.registered &&
      !pairingInProgress &&
      currentSock === sock
    ) {

      pairingInProgress = true

      try {

        const code =
          await sock.requestPairingCode(
            number
          )

        currentPairingCode = code

        console.log("")
        console.log(
          "================================"
        )
        console.log(
          "🔑 CODE DE JUMELAGE 𝐋Ξ𝐑Ø𝐈-MD"
        )
        console.log(
          `   ${code}`
        )
        console.log(
          "================================"
        )
        console.log("")

        console.log(
          "WhatsApp → Paramètres → Appareils liés →"
        )

        console.log(
          "Lier un appareil → Lier avec un numéro de téléphone"
        )

      } catch (error) {

        console.error(
          "❌ IMPOSSIBLE DE GÉNÉRER LE CODE:",
          error
        )

        currentPairingCode = null
        pairingInProgress = false
      }
    }
  }

  return sock
}

/*
 * SERVEUR HTTP POUR RENDER
 */
const server = http.createServer(
  async (req, res) => {

    /*
     * PAGE PRINCIPALE
     */
    if (
      req.method === "GET" &&
      req.url === "/"
    ) {

      res.writeHead(200, {
        "Content-Type":
          "text/html; charset=utf-8"
      })

      res.end(`
<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<title>𝐋Ξ𝐑Ø𝐈-MD</title>

</head>

<body style="
font-family:sans-serif;
text-align:center;
padding:40px;
background:#111;
color:#fff;
">

<h1>🔥 𝐋Ξ𝐑Ø𝐈-MD 🔥</h1>

<p>
Statut:
${
  currentSock
    ? "🟢 Serveur actif"
    : "🟠 Démarrage..."
}
</p>

${
  currentPairingCode
    ? `
<h2 style="color:#00ff66;">
🔑 Code de jumelage
</h2>

<h1 style="letter-spacing:5px;">
${currentPairingCode}
</h1>

<p>
WhatsApp → Paramètres → Appareils liés →
Lier un appareil → Lier avec un numéro
</p>
`
    : `
<p>
Le code de jumelage apparaîtra ici lorsqu'il sera disponible.
</p>
`
}

</body>

</html>
`)

      return
    }

    /*
     * HEALTH CHECK RENDER
     */
    res.writeHead(200, {
      "Content-Type":
        "text/plain"
    })

    res.end(
      "𝐋Ξ𝐑Ø𝐈-MD is running"
    )
  }
)

const PORT =
  process.env.PORT || 3000

server.listen(
  PORT,
  () => {

    console.log(
      `🌐 𝐋Ξ𝐑Ø𝐈-MD serveur actif sur le port ${PORT}`
    )

  }
)

/*
 * UNE SEULE INITIALISATION
 */
start().catch(error => {

  console.error(
    "❌ Erreur démarrage 𝐋Ξ𝐑Ø𝐈-MD:",
    error
  )

})
