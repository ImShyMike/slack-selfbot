import type { Command } from "../types";

export default {
    name: "inspect",
    description: "Inspect a message.",
    args: "<channel_id> <message_ts> OR <message_link>",
    handler: async (msg, args, ctx) => {
        let channelId: string | undefined = args[0];
        let messageTs: string | undefined = args[1];

        if (args.length === 1) {
            const messageLink = args[0];
            if (!messageLink) {
                await ctx.chatPostEphemeral(msg.channel, "Invalid message link", msg.thread_ts);
                return;
            }
            const match = messageLink.match(/https:\/\/.*\.slack\.com\/archives\/([^/]+)\/p(\d{10})(\d{6})/);
            if (!match) {
                await ctx.chatPostEphemeral(msg.channel, "Invalid message link", msg.thread_ts);
                return;
            }
            channelId = match[1];
            messageTs = `${match[2]}.${match[3]}`;
        } else if (args.length !== 2) {
            await ctx.chatPostEphemeral(
                msg.channel,
                "Usage: `inspect <channel_id> <message_ts> OR <message_link>`",
                msg.thread_ts,
            );
            return;
        }

        if (!channelId || !messageTs) {
            await ctx.chatPostEphemeral(msg.channel, "Invalid message link", msg.thread_ts);
            return;
        }

        const raw = await ctx.getMessage(channelId, messageTs);
        if (raw) {
            await ctx.chatPostEphemeral(msg.channel, `\`\`\`${JSON.stringify(raw, null, 2)}\`\`\``, msg.thread_ts);
        } else {
            await ctx.chatPostEphemeral(msg.channel, "Message not found", msg.thread_ts);
        }
    },
} satisfies Command;
