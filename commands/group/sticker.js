
export default {
  name: "sticker",
  alias: ["s"],
  async execute(sock,m,{from}) {
    const q = m.message.extendedTextMessage?.contextInfo?.quotedMessage
    let media = m.message.imageMessage || m.message.videoMessage || q?.imageMessage || q?.videoMessage
    if(!media) return m.reply("Envoie une image avec .sticker")
    // Note: besoin de ffmpeg pour conversion webp, simplifié ici
    await sock.sendMessage(from, { sticker: media })
  }
}
