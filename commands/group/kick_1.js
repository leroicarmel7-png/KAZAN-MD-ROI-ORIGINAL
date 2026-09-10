
import { botConfig } from "../../config.js"
export default {
  name: "kick",
  async execute(sock, m, args, { isAdmin, isBotAdmin, from }) {
    if (!isAdmin) return m.reply(botConfig.messages.notAdmin)
    if (!isBotAdmin) return m.reply(botConfig.messages.botNotAdmin)
    const target = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || m.quoted?.participant
    if (!target) return m.reply(`Utilise: ${botConfig.prefix}kick @user`)
    let text = `┌─『 💀 KICK 』\n│\n│ ✦ Cible: @${target.split("@")[0]}\n│ ✦ Par: ${botConfig.initiatorTag}\n│\n│ > Expulsé du royaume KAZAN 🌋\n└────────────────`
    await sock.sendMessage(from, { text, mentions: [target] })
    await new Promise(r => setTimeout(r, 1000))
    await sock.groupParticipantsUpdate(from, [target], "remove")
  }
}
