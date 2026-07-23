import type { ReactionTrigger } from "../types";

export default {
    name: "magnet",
    remove: true,
    resolveMessage: true,
    me: async (msg, ctx) => {
        const messageReactions = msg.reactions ?? [];
        const filteredReactions = messageReactions.filter(
            (reaction) => !(reaction.name === "magnet" && reaction.users[0] === ctx.selfUserId),
        );

        if (filteredReactions.length === 0) {
            await ctx.chatPostEphemeral(msg.channel, "No reactions found on this message.", msg.thread_ts);
            return;
        }

        const reactionCounts = filteredReactions.map(
            (reaction) =>
                `:${reaction.name}: (${reaction.count}): <@${reaction.users?.join("> <@") ?? "No users found"}>`,
        );
        const constructedMessage = `Reactions:\n${reactionCounts.join("\n")}`;

        await ctx.chatPostEphemeral(msg.channel, constructedMessage, msg.thread_ts);
    },
} satisfies ReactionTrigger;
