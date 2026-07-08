import { ButtonInteraction } from 'discord.js';

export async function execute(interaction: ButtonInteraction) {
  // Acknowledge and update the message
  await interaction.update({ content: '✅ Skipped prize configuration.', embeds: [], components: [] });
}
