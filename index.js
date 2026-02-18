const { Client, GatewayIntentBits } = require("discord.js");
const { Shoukaku, Connectors } = require("shoukaku");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

/* ============================= */
/* LAVALINK CONFIG */
/* ============================= */

const nodes = [
  {
    name: "https://discord-lavalink.onrender.com",
    url: "localhost:2333",
    auth: "youshallnotpass",
    secure: false
  }
];

const shoukaku = new Shoukaku(
  new Connectors.DiscordJS(client),
  nodes
);

/* ============================= */
/* GLOBAL STORAGE */
/* ============================= */

const players = new Map();   // guildId -> player
const queues = new Map();    // guildId -> track array
const idleTimers = new Map();
const nowPlaying = new Map(); // guildId -> track


/* ============================= */
/* HELPERS */
/* ============================= */
function createProgressBar(position, duration) {
  const totalBars = 20;
  const progress = Math.floor((position / duration) * totalBars);

  return (
    "▬".repeat(progress) +
    "🔘" +
    "▬".repeat(totalBars - progress)
  );
}

function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function playNext(guildId) {
  const queue = queues.get(guildId);
  const player = players.get(guildId);

  if (!queue || queue.length === 0) {
    const timer = setTimeout(() => {
      if (player) player.connection.disconnect();
      players.delete(guildId);
      queues.delete(guildId);
    }, 30000);

    idleTimers.set(guildId, timer);
    return;
  }

  const track = queue.shift();
  nowPlaying.set(guildId, track);
  await player.playTrack({ track: track.encoded });

}

/* ============================= */
/* LAVALINK EVENTS */
/* ============================= */

shoukaku.on("ready", name => {
  console.log(`Node ${name} connected.`);
});

shoukaku.on("error", (name, error) => {
  console.error(`Node ${name} error:`, error);
});

/* ============================= */
/* BOT READY */
/* ============================= */

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

/* ============================= */
/* COMMAND HANDLER */
/* ============================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const guildId = interaction.guild.id;
  const command = interaction.commandName;

  /* ================= PLAY ================= */

  if (command === "play") {
    await interaction.deferReply();

    const voice = interaction.member.voice.channel;
    if (!voice)
      return interaction.editReply("Join a voice channel first!");

    const node = shoukaku.nodes.get("local");
    if (!node)
      return interaction.editReply("Lavalink not connected.");

    const query = interaction.options.getString("song");

    try {
      const searchResult = await node.rest.resolve(`ytsearch:${query}`);

      if (!searchResult || !searchResult.tracks.length)
        return interaction.editReply("No results found!");

      const track = searchResult.tracks[0];

      let player = players.get(guildId);

      if (!player) {
        player = await node.joinChannel({
          guildId,
          channelId: voice.id,
          shardId: interaction.guild.shardId,
          deaf: true
        });

        players.set(guildId, player);

        player.on("end", () => playNext(guildId));
      }

      clearTimeout(idleTimers.get(guildId));

      if (!queues.has(guildId))
        queues.set(guildId, []);

      queues.get(guildId).push(track);

      if (!player.track)
        await playNext(guildId);

      interaction.editReply(`🎵 Added to queue: **${track.info.title}**`);

    } catch (err) {
      console.error("Play error:", err);
      interaction.editReply("Error playing track.");
    }
  }

  /* ================= SKIP ================= */

  if (command === "skip") {
    const player = players.get(guildId);
    if (!player) return interaction.reply("Nothing playing.");

    await player.stopTrack();
    interaction.reply("⏭ Skipped.");
  }

  /* ================= STOP ================= */

  if (command === "stop") {
    const player = players.get(guildId);
    if (!player) return interaction.reply("Nothing playing.");

    queues.delete(guildId);
    player.connection.disconnect();
    players.delete(guildId);

    interaction.reply("⏹ Stopped and disconnected.");
  }

  /* ================= VOLUME ================= */

  if (command === "volume") {
    const player = players.get(guildId);
    if (!player) return interaction.reply("Nothing playing.");

    const amount = interaction.options.getInteger("amount");
    if (amount < 0 || amount > 150)
      return interaction.reply("Volume must be between 0-150.");

    // Proper Lavalink scaling
    await player.setVolume(amount);

    interaction.reply(`🔊 Volume set to ${amount}%`);
  }

  /* ================= NOW PLAYING ================= */

 if (command === "nowplaying") {
  const track = nowPlaying.get(guildId);

  if (!track) {
    return interaction.reply("Nothing playing right now.");
  }

  const player = players.get(guildId);
  if (!player) {
    return interaction.reply("Nothing playing right now.");
  }

  await interaction.reply("Loading player info...");

  const message = await interaction.fetchReply();

  const interval = setInterval(async () => {
    try {
      if (!nowPlaying.get(guildId)) {
        clearInterval(interval);
        return;
      }

      const position = player.position || 0;
      const duration = track.info.length;

      const bar = createProgressBar(position, duration);

      await message.edit(
        `🎵 **Now Playing**\n` +
        `**${track.info.title}**\n\n` +
        `${formatTime(position)} ${bar} ${formatTime(duration)}`
      );

      if (position >= duration) {
        clearInterval(interval);
      }

    } catch (err) {
      clearInterval(interval);
    }
  }, 3000); // updates every 3 seconds
}


});


require("dotenv").config();

client.login(process.env.DISCORD_TOKEN);


