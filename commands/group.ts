import type { Command } from "../types";

export default {
    name: "group",
    description: "Get all members of a usergroup.",
    args: "<@usergroup>",
    handler: async (msg, args, ctx) => {
        const target = args[0]!;

        let id: string | undefined;
        if (target.startsWith("<!subteam^") && target.endsWith(">")) {
            // Usergroup
            id = target.slice(10, -1);
        }

        if (!id) {
            await ctx.chatPostEphemeral(msg.channel, "Invalid usergroup", msg.thread_ts);
            return;
        }

        let usergroupMembers;
        try {
            usergroupMembers = await ctx.client.usergroupsUsersList({
                usergroup: id,
            });
        } catch (error) {
            await ctx.chatPostEphemeral(msg.channel, `Failed to fetch members of <@${id}>: ${error}`, msg.thread_ts);
            return;
        }

        const members = usergroupMembers.users.join("> <@");
        await ctx.chatPostEphemeral(msg.channel, `Members of <!subteam^${id}>: <@${members}>`, msg.thread_ts);
    },
} satisfies Command;
