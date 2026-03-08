require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const { Manager } = require("erela.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ]
});

const prefix = "!";

const manager = new Manager({
 nodes: [
{
  name: "local",
  host: "newbot-production-b201.up.railway.app",
  port: 2333,
  password: "youshallnotpass"
  secure: false
}
],
  send(id, payload) {
    const guild = client.guilds.cache.get(id);
    if (guild) guild.shard.send(payload);
  }
});

client.once("clientReady", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  manager.init(client.user.id);
});

client.on("raw", (d) => manager.updateVoiceState(d));

manager.on("nodeConnect", node => {
  console.log(`✅ Lavalink node "${node.options.identifier}" connected`);
});

manager.on("nodeError", (node, error) => {
  console.log(`❌ Lavalink error: ${error.message}`);
});

client.on("messageCreate", async (message) => {

  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  const voiceChannel = message.member.voice.channel;

  if (command === "play") {

    if (!voiceChannel)
      return message.reply("❌ Join a voice channel first!");

    const query = args.join(" ");
    if (!query) return message.reply("❌ Provide a song name or URL.");

    let player = manager.players.get(message.guild.id);

    if (!player) {
      player = manager.create({
        guild: message.guild.id,
        voiceChannel: voiceChannel.id,
        textChannel: message.channel.id,
        selfDeafen: true
      });

      player.connect();
    }

    const res = await manager.search(query, message.author);

    if (res.loadType === "NO_MATCHES")
      return message.reply("❌ No results found.");

    const track = res.tracks[0];

    player.queue.add(track);

    if (!player.playing && !player.paused)
      player.play();

    message.reply(`🎵 Now playing: **${track.title}**`);
  }

  if (command === "skip") {

    const player = manager.players.get(message.guild.id);
    if (!player) return message.reply("❌ Nothing playing.");

    player.stop();
    message.reply("⏭ Skipped.");
  }

  if (command === "stop") {

    const player = manager.players.get(message.guild.id);
    if (!player) return message.reply("❌ Nothing playing.");

    player.destroy();
    message.reply("🛑 Stopped music.");
  }

  if (command === "queue") {

    const player = manager.players.get(message.guild.id);
    if (!player || !player.queue.size)
      return message.reply("📭 Queue is empty.");

    const tracks = player.queue.slice(0, 10)
      .map((t, i) => `${i + 1}. ${t.title}`)
      .join("\n");

    message.reply(`📜 **Queue:**\n${tracks}`);
  }

});

client.login(process.env.TOKEN);
