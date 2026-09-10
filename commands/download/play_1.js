
import ytSearch from "yt-search"
export default {
  name: "play",
  alias: ["song","music"],
  async execute(sock,m,args,{from}) {
    if(!args.length) return m.reply("Utilise: .play <nom musique>")
    let q = args.join(" ")
    m.reply(`🔍 Recherche: ${q} - par ༼ 𝐑Ø𝐈༽ †🌹ᴼᴿᴵᴳᴵᴺᴬᴸ•🐦‍🔥𝐊𝐀𝐙𝐀𝐍`)
    let search = await ytSearch(q)
    let video = search.videos[0]
    if(!video) return m.reply("Pas trouvé")
    await sock.sendMessage(from, { image: { url: video.thumbnail }, caption: `🎵 ${video.title}\n⏱️ ${video.timestamp}\n🔗 ${video.url}\n\n_Téléchargement audio..._` })
    // Ici tu ajoutes ytdl-core pour envoyer l'audio: ytdl(video.url, {filter:'audioonly'})
    // await sock.sendMessage(from, { audio: { url: audioUrl }, mimetype: "audio/mp4" })
    m.reply("⚠️ Installe ytdl-core et décommente la ligne d'envoi audio dans play.js")
  }
}
