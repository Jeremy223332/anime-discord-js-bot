
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  throw new Error(
    "Set DISCORD_TOKEN, CLIENT_ID, and GUILD_ID in your host environment."
  );
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const dataDir = path.join(__dirname, "data");
const settingsFile = path.join(dataDir, "settings.json");

fs.mkdirSync(dataDir, { recursive: true });

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsFile, "utf8"));
  } catch {
    return {};
  }
}

const settings = loadSettings();

function saveSettings() {
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

const channelTypes = [
  { name: "Welcome", value: "welcome" },
  { name: "Announcements", value: "announcements" },
  { name: "VRChat Events", value: "events" },
  { name: "Moderation Logs", value: "modlogs" }
];

const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check whether ANIME NEXUS is online"),

  new SlashCommandBuilder()
    .setName("setup-channel")
    .setDescription("Configure a channel for automatic bot posts")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option =>
      option.setName("type")
        .setDescription("Which channel are you configuring?")
        .setRequired(true)
        .addChoices(...channelTypes)
    )
    .addChannelOption(option =>
      option.setName("channel")
        .setDescription("Where should the bot post?")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Post an official ANIME NEXUS announcement")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(option =>
      option.setName("channel")
        .setDescription("Where should the announcement go?")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("message")
        .setDescription("What should the announcement say?")
        .setRequired(true)
        .setMaxLength(4000)
    ),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show ANIME NEXUS bot commands")
].map(command => command.toJSON());

client.once("ready", () => {
  console.log(`ANIME NEXUS is online as ${client.user.tag}`);
  client.user.setActivity("over ANIME NEXUS 🌌");
});

client.on("guildMemberAdd", async member => {
  const channelId = settings[member.guild.id]?.welcome;
  if (!channelId) return;

  const channel = await member.guild.channels
    .fetch(channelId)
    .catch(() => null);

  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(0x8B5CF6)
    .setTitle("🌌 Welcome to ANIME NEXUS!")
    .setDescription(
      `Welcome ${member}!\n\n` +
      "We're glad you're here. Enjoy our anime community " +
      "and VRChat events!"
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setFooter({ text: "ANIME NEXUS • One Community. Two Worlds." })
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(console.error);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ping") {
    return interaction.reply({
      content: `🌌 ANIME NEXUS is online! Latency: ${client.ws.ping}ms`,
      ephemeral: true
    });
  }

  if (interaction.commandName === "help") {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x8B5CF6)
          .setTitle("🌌 ANIME NEXUS Commands")
          .setDescription(
            "`/ping` — Check bot status\n" +
            "`/setup-channel` — Configure automatic posts\n" +
            "`/announce` — Publish a staff announcement\n" +
            "`/help` — Show this help menu"
          )
      ],
      ephemeral: true
    });
  }

  if (interaction.commandName === "setup-channel") {
    if (!interaction.memberPermissions?.has(
      PermissionFlagsBits.ManageGuild
    )) {
      return interaction.reply({
        content: "⛔ You need Manage Server permission.",
        ephemeral: true
      });
    }

    const type = interaction.options.getString("type");
    const channel = interaction.options.getChannel("channel");

    if (
      !channel ||
      !channel.isTextBased() ||
      !channel.guild ||
      channel.guild.id !== interaction.guildId
    ) {
      return interaction.reply({
        content: "Please select a text channel in this server.",
        ephemeral: true
      });
    }

    settings[interaction.guildId] ??= {};
    settings[interaction.guildId][type] = channel.id;
    saveSettings();

    return interaction.reply({
      content: `✅ The **${type}** channel is now ${channel}.`,
      ephemeral: true
    });
  }

  if (interaction.commandName === "announce") {
    if (!interaction.memberPermissions?.has(
      PermissionFlagsBits.ManageGuild
    )) {
      return interaction.reply({
        content: "⛔ You need Manage Server permission.",
        ephemeral: true
      });
    }

    const channel = interaction.options.getChannel("channel");
    const message = interaction.options.getString("message", true);

    if (
      !channel ||
      !channel.isTextBased() ||
      !channel.guild ||
      channel.guild.id !== interaction.guildId
    ) {
      return interaction.reply({
        content: "Please select a text channel in this server.",
        ephemeral: true
      });
    }

    const botPermissions = channel.permissionsFor(client.user);
    if (!botPermissions?.has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks
    ])) {
      return interaction.reply({
        content: "I need permission to view and post embeds in that channel.",
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x8B5CF6)
      .setTitle("🌌 ANIME NEXUS Announcement")
      .setDescription(message)
      .setFooter({ text: `Posted by ${interaction.user.username}` })
      .setTimestamp();

    try {
      await channel.send({ embeds: [embed] });
      return interaction.reply({
        content: `✅ Announcement posted in ${channel}.`,
        ephemeral: true
      });
    } catch (error) {
      console.error(error);
      return interaction.reply({
        content: "❌ Couldn't post there. Check my channel permissions.",
        ephemeral: true
      });
    }
  }
});

async function start() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log("ANIME NEXUS commands registered.");
  await client.login(TOKEN);
}

start().catch(error => {
  console.error("Failed to start ANIME NEXUS:", error);
  process.exit(1);
});
