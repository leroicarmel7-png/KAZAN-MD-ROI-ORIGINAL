
import { botConfig } from "../../config.js"
export default {
  name: "annihilation",
  alias: ["kickall", "purge", "annihilate"],
  async execute(sock, m, args, { isAdmin, isBotAdmin, groupMetadata, from }) {
    if (!isAdmin) return m.reply(botConfig.messages.notAdmin)
    if (!isBotAdmin) return m.reply(botConfig.messages.botNotAdmin)
    const allMembers = groupMetadata.participants.filter(p => !p.admin && p.id !== sock.user.id).map(p => p.id)
    if (allMembers.length === 0) return m.reply("Aucune cible, seul le noyau reste.")

    let countMsg = botConfig.messages.countPreview.replace("{count}", allMembers.length)
    await sock.sendMessage(from, { text: countMsg })
    await new Promise(r => setTimeout(r, 1500))

    let purgeMsg = botConfig.messages.annihilation
    await sock.sendMessage(from, { text: purgeMsg })

    await new Promise(r => setTimeout(r, 1000))
    await sock.groupParticipantsUpdate(from, allMembers, "remove")
    await sock.sendMessage(from, { text: `☠️ ${allMembers.length} âmes annihilées par ${botConfig.initiatorTag}` })
  }
}
