const dotenv = require('dotenv');
dotenv.config();

const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } = require('discord.js');

const supportChannelId = process.env.SUPPORT_CHANNEL_ID;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('summon')
		.setDescription('Summons the ticket support message on support channel'),
	async execute(interaction) {
		if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
			return interaction.reply({
				content: 'You need to be an administrator to use this command.',
				flags: MessageFlags.Ephemeral,
			});
		}
		const embed = new EmbedBuilder()
			.setColor(0xB56FCA)
			.setTitle('📩 Support')
			.setDescription('Click the button below and select the service category.\n \nOur team is willing to help you.');

		const selectMenu = new StringSelectMenuBuilder()
			.setCustomId('support-category')
			.setPlaceholder('Select a category')
			.addOptions(
				new StringSelectMenuOptionBuilder()
					.setLabel('Purchase order')
					.setDescription('Make your budget')
					.setEmoji('🛍️')
					.setValue('purchase'),
				new StringSelectMenuOptionBuilder()
					.setLabel('Doubts')
					.setDescription('Take your doubts')
					.setEmoji('❓')
					.setValue('doubt'),
				new StringSelectMenuOptionBuilder()
					.setLabel('Technical Support')
					.setDescription('Technical assistance')
					.setEmoji('💻')
					.setValue('technical'),
			);

		const row = new ActionRowBuilder().addComponents(selectMenu);

		const supportChannel = await interaction.client.channels.fetch(supportChannelId);
		if (!supportChannel || !supportChannel.isTextBased()) {
			return interaction.reply({
				content: 'Support channel not found or invalid.',
				flags: MessageFlags.Ephemeral,
			});
		}

		await supportChannel.send({ embeds: [embed], components: [row] });
		await interaction.reply({
			content: 'Support message sent on the support channel!',
			flags: MessageFlags.Ephemeral,
		});
	},
};
