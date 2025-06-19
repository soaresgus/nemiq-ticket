const dotenv = require('dotenv');
dotenv.config();

const fs = require('fs');
const path = require('path');
const { Client, Collection, MessageFlags, Events, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const token = process.env.DISCORD_TOKEN;
const supportChannelId = process.env.SUPPORT_CHANNEL_ID;
const supportRoleId = process.env.SUPPORT_ROLE_ID;

if (supportRoleId == null) {
	throw new Error('Support role ID not defined');
}

if (supportChannelId == null) {
	throw new Error('Support channel ID not defined');
}

if (token == null) {
	throw new Error('Token not defined');
}

const client = new Client({ intents: [
	GatewayIntentBits.Guilds,
	GatewayIntentBits.GuildMembers,
	GatewayIntentBits.GuildMessages,
	GatewayIntentBits.MessageContent,
] });

client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		}
		else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

async function handleSupportCategory(interaction, channelId) {
	const selected = interaction.values[0];
	const channel = await interaction.client.channels.fetch(channelId);

	if (!channel || !channel.isTextBased()) {
		return interaction.reply({
			content: 'Support channel not found or invalid.',
			flags: MessageFlags.Ephemeral,
		});
	}

	const activeThreads = await channel.threads.fetchActive();
	let userHasThread = false;

	for (const thread of activeThreads.threads.values()) {
		const members = await thread.members.fetch();
		if (members.has(interaction.user.id)) {
			userHasThread = true;
			break;
		}
	}

	if (userHasThread) {
		return interaction.reply({
			content: 'You already have an open ticket! Close your last ticket to open another.',
			flags: MessageFlags.Ephemeral,
		});
	}

	let threadName = '';
	let response = '';

	switch (selected) {
	case 'purchase':
		threadName = `🛍️ Purchase - ${interaction.user.username}`;
		response = '🛍️ Thread created for **Purchase order**!';
		break;
	case 'doubt':
		threadName = `❓ Doubt - ${interaction.user.username}`;
		response = '❓ Thread created for **Doubt**!';
		break;
	case 'technical':
		threadName = `💻 Support - ${interaction.user.username}`;
		response = '💻 Thread created for **Technical Support**!';
		break;
	default:
		return interaction.reply({
			content: 'Not recognized category.',
			flags: MessageFlags.Ephemeral,
		});
	}

	const thread = await channel.threads.create({
		name: threadName,
		autoArchiveDuration: 4320,
		reason: `Support thread created by ${interaction.user.tag}`,
	});

	await thread.members.add(interaction.user.id);

	await thread.send(`<@&${supportRoleId}> New ticket created by <@${interaction.user.id}>!`);

	const closeButton = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId('close-ticket')
			.setLabel('❌ Close Ticket')
			.setStyle(ButtonStyle.Danger),
	);

	await thread.send({
		components: [closeButton],
	});

	const messages = await channel.messages.fetch({ limit: 100 });
	const deletions = messages.filter(msg => msg.embeds.length === 0);
	for (const msg of deletions.values()) {
		await msg.delete();
	}

	return interaction.reply({
		content: `${response}\n${thread.toString()}`,
		flags: MessageFlags.Ephemeral,
	});
}

async function handleCloseTicketButton(interaction) {
	const channel = interaction.channel;

	if (!channel || !channel.isThread()) {
		return interaction.reply({
			content: 'This button can only be used within a ticket thread.',
			flags: MessageFlags.Ephemeral,
		});
	}

	const thread = await channel.fetch();

	if (thread.locked || thread.archived) {
		return interaction.reply({
			content: 'This ticket is already closed.',
			flags: MessageFlags.Ephemeral,
		});
	}

	await interaction.reply({
		content: `Ticket closed by <@${interaction.user.id}>.`,
	});

	await thread.setLocked(true, `Ticket closed by ${interaction.user.tag}`);
	await thread.setArchived(true, `Ticket closed by ${interaction.user.tag}`);
}

client.on(Events.InteractionCreate, async interaction => {
	if (interaction.isStringSelectMenu() && interaction.customId === 'support-category') {
		return handleSupportCategory(interaction, supportChannelId);
	}

	if (interaction.isButton() && interaction.customId === 'close-ticket') {
		return handleCloseTicketButton(interaction);
	}

	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	}
	catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
		}
		else {
			await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
		}
	}
});

client.once(Events.ClientReady, readyClient => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.login(token);
