import type { Command } from "../types";

export default {
    name: "echo",
    description: "Send a message as yourself.",
    args: "<text>",
    handler: async (msg, args, context) => {
        context.client.chatPostMessage({
            channel: msg.channel,
            thread_ts: msg.thread_ts,
            ts: msg.ts,
            // @ts-ignore
            text: args.join(" "),
        });
    },
} satisfies Command;
