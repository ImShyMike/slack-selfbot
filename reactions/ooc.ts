import type { ReactionTrigger } from "../types";

let oocCache: Set<string> = new Set();

export default {
    name: "i-would-ooc-this-but-i-cant",
    any: async (msg, ctx) => {
        if (!oocCache.has(`${msg.channel}-${msg.ts}`)) {
            await ctx.client.chatPostMessage({
                channel: ctx.userChannelId,
                text: `Waiter, waiter! One more <https://${ctx.workspace}.slack.com/archives/${msg.channel}/p${msg.ts.replace(".", "")}|OOC> please!`,
            });
            oocCache.add(`${msg.channel}-${msg.ts}`);
        }
    },
} satisfies ReactionTrigger;
