import type { ReactionTrigger } from "../types";

async function getChannelName(channelId: string): Promise<string> {
    return fetch(`https://flaron.halceon.dev/cid/${channelId}`)
        .then((res) => res.json())
        .then((data) => (data as any).name ?? "unknown :(");
}

async function getChannelNames(channelIds: string[]): Promise<string[]> {
    const dedupedIds = [...new Set(channelIds)];
    const namesById = new Map(await Promise.all(dedupedIds.map(async (id) => [id, await getChannelName(id)] as const)));

    return channelIds.map((id) => namesById.get(id) ?? "unknown :(");
}

export default {
    name: "private",
    me: async (msg, _reaction, ctx) => {
        const message = await ctx.client.conversationsHistory({
            channel: msg.channel,
            latest: msg.ts,
            limit: 1,
            inclusive: true,
        });
        if (!message.messages || message.messages.length === 0) {
            console.error("Could not find message for reaction trigger");
            return;
        }
        const firstMessage = message.messages?.[0];
        if (!firstMessage) {
            console.error("Could not find message for reaction trigger");
            return;
        }

        const messageText = firstMessage.text ?? "";
        const channels = [...messageText.matchAll(/<#(\w+)(?:\|[^>]*)?>/g)];
        const channelIds = channels.flatMap((channel) => (channel[1] ? [channel[1]] : []));

        const channelNames = await getChannelNames(channelIds);

        const constructedMessage =
            channelIds.length > 0
                ? channelIds.map((channelId, index) => `\`${channelId}\`: ${channelNames[index]}`).join("\n")
                : "No channels found in message";

        await ctx.chatPostEphemeral(msg.channel, constructedMessage, msg.thread_ts);
    },
} satisfies ReactionTrigger;
