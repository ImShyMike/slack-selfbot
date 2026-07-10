import type { ReactionTrigger } from "../types";

export default {
    name: "i-would-ooc-this-but-i-cant",
    any: async (msg, ctx) => {
        await ctx.client.chatPostMessage({
            channel: ctx.userChannelId,
            text: `Waiter, waiter! One more <https://${ctx.workspace}.slack.com/archives/${msg.channel}/p${msg.ts.replace(".", "")}|OOC> please!`,
        });
    },
} satisfies ReactionTrigger;
