#!/usr/bin/env bun

import { SlackClient } from 'slack-undoc-client';

const SLACK_COOKIE = process.env.SLACK_COOKIE;
const SLACK_XOXP = process.env.SLACK_XOXP;
const SLACK_WORKSPACE = process.env.SLACK_WORKSPACE || 'hackclub';

if (!SLACK_COOKIE) {
  throw new Error('SLACK_COOKIE environment variable is not set.');
} else if (!SLACK_XOXP) {
  throw new Error('SLACK_XOXP environment variable is not set.');
}

const client = await SlackClient.create({
    cookie: SLACK_COOKIE,
    workspace: SLACK_WORKSPACE,
})

const userInfo = await client.authTest();
const userChannelId: string = (await client.callUnknown("conversations.open", {
    users: userInfo.user_id,
}) as any).channel.id;

console.log(`Logged in as ${userInfo.user} (${userInfo.user_id})`);

let websocketUrl: string = `wss://wss-primary.slack.com/?token=${client.token}&sync_desync=1&slack_client=desktop&start_args=?agent=client&org_wide_aware=true&eac_cache_ts=true&cache_ts=0&name_tagging=true&only_self_subteams=true&connect_only=true&ms_latest=true&no_query_on_subscribe=1&flannel=3&lazy_channels=1&gateway_server=T09V59WQY1E-1&enterprise_id=E09V59WQY1E&batch_presence_aware=1`;

let ws: WebSocket | undefined;
let reconnectTimer: Timer | undefined;

function chatPostEphemeral(channel: string, text: string, thread_ts?: string) {
    fetch("https://slack.com/api/chat.postEphemeral", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${SLACK_XOXP}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            channel,
            text,
            thread_ts,
            user: userInfo.user_id,
        }),
    });
}

async function getChannelName(channelId: string): Promise<string> {
    return fetch(`https://flaron.halceon.dev/cid/${channelId}`)
        .then(res => res.json())
        .then(data => (data as any).name ?? "unknown :(");
}

async function getChannelNames(channelIds: string[]): Promise<string[]> {
    const dedupedIds = [...new Set(channelIds)];
    const namesById = new Map(await Promise.all(
        dedupedIds.map(async id => [id, await getChannelName(id)] as const),
    ));

    return channelIds.map(id => namesById.get(id) ?? "unknown :(");
}

type MessageMetadata = {
    text: string;
    blocks: any[];
    ts: string;
    channel: string;
    user: string;
    thread_ts?: string;
}

type ShallowMessageMetadata = {
    ts: string;
    channel: string;
    user: string;
    thread_ts?: string;
}

type Command = {
    description: string;
    args?: string;
    handler: (msg: MessageMetadata, args: string[]) => Promise<void>;
}

type ReactionTrigger = {
    /// Only triggers when the reaction is added by the selfbot user
    me?: (msg: ShallowMessageMetadata, reaction: string) => Promise<void>;
    /// Triggers when the reaction is added by any user (including the selfbot user)
    any?: (msg: ShallowMessageMetadata, reaction: string) => Promise<void>;
}

function formatHelpText() {
    return Object.entries(COMMANDS)
        .map(([name, command]) => {
            const usage = command.args ? `*${name}* ${command.args}` : `*${name}*`;
            return `- ${usage}: ${command.description}`;
        })
        .join("\n");
}

const REACTION_TRIGGERS: Record<string, ReactionTrigger> = {
    "i-would-ooc-this-but-i-cant": {
        any: async (msg: ShallowMessageMetadata) => {
            await client.chatPostMessage({
                channel: userChannelId,
                // @ts-ignore
                text: `Waiter, waiter! One more <https://${SLACK_WORKSPACE}.slack.com/archives/${msg.channel}/p${msg.ts.replace(".","")}|OOC> please!`,
            });
        },
    },
    "private": {
        me: async (msg: ShallowMessageMetadata) => {
            const message = await client.conversationsHistory({
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
            const channelIds = channels.flatMap(channel => channel[1] ? [channel[1]] : []);

            const channelNames = await getChannelNames(channelIds);

            const constructedMessage = channelIds.length > 0
                ? channelIds.map((channelId, index) => `\`${channelId}\`: ${channelNames[index]}`).join("\n")
                : "No channels found in message";

            chatPostEphemeral(msg.channel, constructedMessage, msg.thread_ts);
        },
    },
}

const COMMANDS: Record<string, Command> = {
    "help": {
        description: "Show this help message.",
        args: "[command]",
        handler: async (msg: MessageMetadata, args: string[]) => {
            const commandName = args[0];
            if (commandName && COMMANDS[commandName]) {
                const command = COMMANDS[commandName];
                const usage = command.args ? `${commandName} ${command.args}` : commandName;
                chatPostEphemeral(msg.channel, `${usage}: ${command.description}`, msg.thread_ts);
                return;
            }

            chatPostEphemeral(msg.channel, `Available commands:\n${formatHelpText()}`, msg.thread_ts);
        },
    },
    "ping": {
        description: "Check whether the selfbot is running.",
        handler: async (msg: MessageMetadata, args: string[]) => {
            chatPostEphemeral(msg.channel, `Pong!`, msg.thread_ts);
        },
    },
    "echo": {
        description: "Send a message as yourself.",
        args: "<text>",
        handler: async (msg: MessageMetadata, args: string[]) => {
            const echoText = args.join(" ");
            client.chatPostMessage({
                channel: msg.channel,
                thread_ts: msg.thread_ts,
                ts: msg.ts,
                // @ts-ignore
                text: echoText,
            });
        },
    },
    "id": {
        description: "Get the ID of a user, channel or usergroup.",
        args: "<@user|#channel|@usergroup>",
        handler: async (msg: MessageMetadata, args: string[]) => {
            const target = args[0];
            if (!target) {
                chatPostEphemeral(msg.channel, "Please provide a user, channel or usergroup.", msg.thread_ts);
                return;
            }

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
                chatPostEphemeral(msg.channel, "Invalid user, channel or usergroup.", msg.thread_ts);
                return;
            }

            chatPostEphemeral(msg.channel, id, msg.thread_ts);
        },
    },
}

function connect() {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
        return;
    }

    ws = new WebSocket(
        websocketUrl, {
        headers: {
            Cookie: `d=${SLACK_COOKIE}`
        }
    });

    ws.addEventListener("message", async (event) => {
        const data = JSON.parse(event.data);
        switch (data.type) {
            case "hello":
                console.log(`Connected to '${data.region}' (${data.host_id})`);
                break;
            case "reconnect_url":
                websocketUrl = data.url;
                break;
            case "reaction_added":
                //console.log(`Reaction added: ${data.reaction} by ${data.user} in ${data.item.channel}`);
                const trigger = REACTION_TRIGGERS[data.reaction];
                if (trigger) {
                    const msg: ShallowMessageMetadata = {
                        ts: data.item.ts,
                        channel: data.item.channel,
                        user: data.user,
                    };
                    if (trigger.any) {
                        await trigger.any(msg, data.reaction);
                    } else if (data.user === userInfo.user_id && trigger.me) {
                        await trigger.me(msg, data.reaction);
                    }
                    
                }
                break;
            case "message":
                if (data.subtype !== "me_message" || data.user !== userInfo.user_id) return;
                client.chatDelete({
                    channel: data.channel,
                    ts: data.ts,
                });
                const messageText: string = data.text.trim();
                const [command, ...args] = messageText.split(/\s+/);
                if (!command) return;

                const msg: MessageMetadata = {
                    text: messageText,
                    blocks: data.blocks,
                    ts: data.ts,
                    channel: data.channel,
                    user: data.user,
                    thread_ts: data.thread_ts,
                };

                const commandDef = COMMANDS[command];
                if (commandDef) {
                    await commandDef.handler(msg, args);
                }
                break;
            default:
                // console.log("Received unknown event:", data.type);
                // await Bun.write(`./events/${data.type}.json`, JSON.stringify(data, null, 2));
                break;
        }
    });

    ws.addEventListener("close", () => {
        ws = undefined;
        console.log("Disconnected from websocket, reconnecting...");
        if (!reconnectTimer) {
            reconnectTimer = setTimeout(() => {
                reconnectTimer = undefined;
                connect();
            }, 1000);
        }
    });

    ws.addEventListener("error", () => {
        ws?.close();
    });
}

connect();
