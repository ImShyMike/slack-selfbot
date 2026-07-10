import type { Command } from "../types";

export default {
    name: "channel",
    description: "Get a channel name from a channel ID.",
    args: "<channel_id>",
    handler: async (msg, args, ctx) => {
        const channelId: string = args[0]!;
        const channelName = ctx.getChannelName(channelId) ?? "unknown :(";

        await ctx.chatPostEphemeral(msg.channel, `\`${channelId}\`: ${channelName}`, msg.thread_ts);
    },
} satisfies Command;
