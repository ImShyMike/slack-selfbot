import type { Command } from "../types";

export default {
    name: "mrkdwn",
    description: "Send a message with mrkdwn formatting.",
    args: "<text>",
    handler: async (msg, args, ctx) => {
        ctx.client.chatPostMessage({
            channel: msg.channel,
            thread_ts: msg.thread_ts,
            ts: msg.ts,
            blocks: JSON.stringify([
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: args.join(" "),
                    },
                },
            ]),
        });
    },
} satisfies Command;
