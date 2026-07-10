import type { ReactionTrigger } from "../types";

export default {
    name: "private",
    me: async (msg, _reaction, ctx) => {
        const message = await ctx.getMessage(msg.channel, msg.ts);
        if (!message) {
            await ctx.chatPostEphemeral(msg.channel, "Message not found", msg.thread_ts);
            return;
        }

        const messageText = message.text ?? "";
        const channels = [...messageText.matchAll(/<#(\w+)(?:\|[^>]*)?>/g)];
        const channelIds = channels.flatMap((channel) => (channel[1] ? [channel[1]] : []));

        const channelNames = await ctx.getChannelNames(channelIds);

        const constructedMessage =
            channelIds.length > 0
                ? channelIds.map((channelId, index) => `\`${channelId}\`: ${channelNames[index]}`).join("\n")
                : "No channels found in message";

        await ctx.chatPostEphemeral(msg.channel, constructedMessage, message.thread_ts);
    },
} satisfies ReactionTrigger;
