
import { botConfig } from "../../config.js"
export default {
  name: "vv",
  alias: ["viewonce"],
  async execute(sock,m,args,{from}) {
    if(!m.quoted) return m.reply("Réponds à une vue unique avec .vv")
    const q = m.quoted.message
    let inner = q.viewOnceMessageV2?.message || q.viewOnceMessage?.message || q
    let type = Object.keys(inner)[0]
    let content = inner[type]
    let caption = `𓍯⃝🐦‍🔥 KAZAN - Vue Unique Déverrouillée\nInitiateur: ${botConfig.initiatorTag}`
    if(type.includes("image")) {
      await sock.sendMessage(from, { image: content, caption })
    } else if(type.includes("video")) {
      await sock.sendMessage(from, { video: content, caption })
    } else if(type.includes("audio")) {
      await sock.sendMessage(from, { audio: content, mimetype: "audio/mp4", ptt: false })
    }
  }
}
