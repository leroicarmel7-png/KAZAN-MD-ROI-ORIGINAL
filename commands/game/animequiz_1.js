
const questions = [
 {q:"Qui est le Hokage 7e?", a:"naruto", options:["Sasuke","Naruto","Kakashi"]},
 {q:"Le One Piece est détenu par?", a:"roger", options:["Luffy","Roger","Whitebeard"]},
 {q:"Quel est le Bankai de Ichigo?", a:"tensa zangetsu", options:["Tensa Zangetsu","Senbonzakura","Zangetsu"]},
]
let scores = {}
export default {
  name: "animequiz",
  async execute(sock,m,args,{from}) {
    let qq = questions[Math.floor(Math.random()*questions.length)]
    await sock.sendMessage(from, { text: `🎮 *ANIME QUIZ - ༼ 𝐑Ø𝐈༽ †🌹ᴼᴿᴵᴳᴵᴺᴬᴸ•🐦‍🔥𝐊𝐀𝐙𝐀𝐍*\n\n❓ ${qq.q}\n\n${qq.options.map((o,i)=>`${i+1}. ${o}`).join("\n")}\n\nRéponds avec le numéro ou le nom!` })
    // Gestion réponse à implémenter avec un collector
  }
}
