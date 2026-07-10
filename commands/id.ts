import type { Command } from "../types";

export default {
    name: "id",
    description: "Get the ID of a user, channel or usergroup.",
    args: "<@user|#channel|@usergroup>",
    handler: async (msg, args, ctx) => {
        const target = args[0]!;

        let id: string | undefined;
        if (target.startsWith("<@") && target.endsWith(">")) {
            // User
            id = target.slice(2, -1).split("|")[0];
        } else if (target.startsWith("<#") && target.endsWith(">")) {
            // Channel
            id = target.slice(2, -1);
        } else if (target.startsWith("<!subteam^") && target.endsWith(">")) {
            // Usergroup
            id = target.slice(10, -1);
        }

        if (!id) {
            await ctx.chatPostEphemeral(msg.channel, "Invalid user, channel or usergroup", msg.thread_ts);
            return;
        }

        await ctx.chatPostEphemeral(msg.channel, id, msg.thread_ts);
    },
} satisfies Command;
