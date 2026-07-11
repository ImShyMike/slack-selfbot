import type { ReactionTrigger } from "../types";

export default {
    name: "private",
    resolveMessage: true,
    me: async (msg, ctx) => {
        const messageText = msg.text ?? "";
        const channels = [...messageText.matchAll(/<#(\w+)(?:\|[^>]*)?>/g)];
        const channelIds = channels.flatMap((channel) => (channel[1] ? [channel[1]] : []));

        const channelNames = await ctx.getChannelNames(channelIds);

        const constructedMessage =
            channelIds.length > 0
                ? channelIds
                      .map((channelId, index) => `\`${channelId}\`: ${channelNames[index] ?? "unknown :("}`)
                      .join("\n")
                : "No channels found in message";

        await ctx.chatPostEphemeral(msg.channel, constructedMessage, msg.thread_ts);
    },
} satisfies ReactionTrigger;
