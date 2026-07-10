import type { Command } from "../types";

export default {
    name: "inspect",
    description: "Inspect a message.",
    args: "<channel_id> <message_ts> OR <message_link>",
    handler: async (msg, args, context) => {
        if (args.length === 0) {
            await context.chatPostEphemeral(
                msg.channel,
                "Usage: `inspect <channel_id> <message_ts> OR <message_link>`",
                msg.thread_ts,
            );
            return;
        } else if (args.length === 1) {
            const messageLink = args[0];
            if (!messageLink) {
                await context.chatPostEphemeral(msg.channel, "Invalid message link.", msg.thread_ts);
                return;
            }
            const match = messageLink.match(/https:\/\/.*\.slack\.com\/archives\/([^/]+)\/p(\d{10})(\d{6})/);
            if (!match) {
                await context.chatPostEphemeral(msg.channel, "Invalid message link.", msg.thread_ts);
                return;
            }
            const channelId = match[1];
            const messageTs = `${match[2]}.${match[3]}`;
            if (!channelId || !messageTs) {
                await context.chatPostEphemeral(msg.channel, "Invalid message link.", msg.thread_ts);
                return;
            }
            const raw = await context.getMessage(channelId, messageTs);
            await context.chatPostEphemeral(msg.channel, `\`\`\`${JSON.stringify(raw, null, 2)}\`\`\``, msg.thread_ts);
        } else if (args.length === 2) {
            const channelId = args[0];
            const messageTs = args[1];
            if (!channelId || !messageTs) {
                await context.chatPostEphemeral(msg.channel, "Invalid channel ID or message timestamp.", msg.thread_ts);
                return;
            }
            const raw = await context.getMessage(channelId, messageTs);
            await context.chatPostEphemeral(msg.channel, `\`\`\`${JSON.stringify(raw, null, 2)}\`\`\``, msg.thread_ts);
        } else {
            await context.chatPostEphemeral(
                msg.channel,
                "Usage: `inspect <channel_id> <message_ts> OR <message_link>`",
                msg.thread_ts,
            );
        }
    },
} satisfies Command;
