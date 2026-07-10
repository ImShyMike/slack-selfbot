import type { ReactionTrigger } from "../types";

export default {
    name: "i-would-ooc-this-but-i-cant",
    any: async (msg, _reaction, context) => {
        await context.client.chatPostMessage({
            channel: context.userChannelId,
            // @ts-ignore
            text: `Waiter, waiter! One more <https://${context.workspace}.slack.com/archives/${msg.channel}/p${msg.ts.replace(".", "")}|OOC> please!`,
        });
    },
} satisfies ReactionTrigger;
