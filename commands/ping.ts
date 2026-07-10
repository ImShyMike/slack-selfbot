import type { Command } from "../types";

export default {
    name: "ping",
    description: "Check whether the selfbot is running.",
    handler: async (msg, _args, ctx) => {
        await ctx.chatPostEphemeral(msg.channel, "Pong!", msg.thread_ts);
    },
} satisfies Command;
