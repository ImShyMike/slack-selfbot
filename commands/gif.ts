import type { Command } from "../types";

const GIFS = (await Bun.file("gifs.json").json()) as Record<string, string>;

export default {
    name: "gif",
    description: "Send a quick react GIF.",
    args: "<gif_name>",
    handler: async (msg, args, ctx) => {
        const gifUrl = GIFS[args[0]!.toLocaleLowerCase()];
        if (!gifUrl) {
            await ctx.chatPostEphemeral(
                msg.channel,
                `Unknown GIF. Available GIFs: ${Object.keys(GIFS)
                    .map((name) => `\`${name}\``)
                    .join(", ")}`,
                msg.thread_ts,
            );
            return;
        }

        await ctx.client.chatPostMessage({
            channel: msg.channel,
            thread_ts: msg.thread_ts,
            ts: msg.ts,
            text: "GIF",
            blocks: JSON.stringify([
                {
                    type: "image",
                    image_url: gifUrl,
                    alt_text: "Reaction GIF",
                    title: { type: "plain_text", text: "GIF", emoji: true },
                },
            ]),
        });
    },
} satisfies Command;
