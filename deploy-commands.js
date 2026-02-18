const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  {
    name: "play",
    description: "Play a song",
    options: [
      {
        name: "song",
        type: 3, // STRING
        description: "Song name or URL",
        required: true
      }
    ]
  },
  {
    name: "skip",
    description: "Skip current song"
  },
  {
    name: "stop",
    description: "Stop music and leave"
  },
  {
    name: "volume",
    description: "Set volume",
    options: [
      {
        name: "amount",
        type: 4, // INTEGER
        description: "Volume (0-100)",
        required: true
      }
    ]
  },
  {
    name: "nowplaying",
    description: "Show current playing song with progress bar"
  }
];


const rest = new REST({ version: '10' }).setToken('MTQ3MzE5ODEzNDk5NzAyNDk0NA.G-5XXj.ayTcmtK2_IONkD1rw4TDOqce8xfaBApnFcbbS0');

(async () => {
    try {
        console.log('Registering commands...');
        await rest.put(
            Routes.applicationCommands('1473198134997024944'),
            { body: commands },
        );
        console.log('Commands registered!');
    } catch (error) {
        console.error(error);
    }
})();


