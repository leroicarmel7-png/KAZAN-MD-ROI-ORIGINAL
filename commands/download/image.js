
export default {
  name: "image",
  alias: ["pinterest","img"],
  async execute(sock,m,args,{from}) {
    if(!args.length) return m.reply(".image <recherche>")
    let q = args.join(" ")
    // Utilise une API pinterest ou unsplash ici
    m.reply(`🖼️ Recherche images: ${q} - Intègre ton API Pinterest dans image.js`)
  }
}
