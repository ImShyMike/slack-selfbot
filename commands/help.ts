import type { Command } from "../types";

function formatHelpText(commands: Record<string, Command>) {
    return Object.entries(commands)
        .map(([name, command]) => {
            const usage = command.args ? `\`${name} ${command.args}\`` : `\`${name}\``;
            return `- ${usage}: ${command.description}`;
        })
        .join("\n");
}

export default {
    name: "help",
    description: "Show this help message.",
    args: "[command]",
    handler: async (msg, args, context) => {
        const commandName = args[0];
        const command = commandName ? context.commands[commandName] : undefined;
        if (commandName && command) {
            const usage = command.args ? `${commandName} ${command.args}` : commandName;
            await context.chatPostEphemeral(msg.channel, `${usage}: ${command.description}`, msg.thread_ts);
            return;
        }

        await context.chatPostEphemeral(
            msg.channel,
            `Available commands:\n${formatHelpText(context.commands)}`,
            msg.thread_ts,
        );
    },
} satisfies Command;
