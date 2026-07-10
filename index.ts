#!/usr/bin/env bun

import { SlackClient } from "slack-undoc-client";
import type { BotContext, Command, MessageMetadata, ReactionTrigger, ShallowMessageMetadata } from "./types";

async function loadModules<T>(pattern: string): Promise<T[]> {
    const glob = new Bun.Glob(pattern);
    const modules: T[] = [];

    for await (const file of glob.scan(".")) {
        const module = await import(`./${file}`);
        modules.push(module.default);
    }

    return modules;
}

const commandModules = await loadModules<Command>("commands/*.ts");
const reactionModules = await loadModules<ReactionTrigger>("reactions/*.ts");

const COMMANDS = Object.fromEntries(commandModules.map((command) => [command.name, command]));

const REACTION_TRIGGERS = Object.fromEntries(reactionModules.map((reaction) => [reaction.name, reaction]));

const SLACK_COOKIE = process.env.SLACK_COOKIE;
const SLACK_XOXP = process.env.SLACK_XOXP;
const SLACK_WORKSPACE = process.env.SLACK_WORKSPACE || "hackclub";

if (!SLACK_COOKIE) {
    throw new Error("SLACK_COOKIE environment variable is not set.");
} else if (!SLACK_XOXP) {
    throw new Error("SLACK_XOXP environment variable is not set.");
}

const client = await SlackClient.create({
    cookie: SLACK_COOKIE,
    workspace: SLACK_WORKSPACE,
});

const selfUserInfo = await client.authTest();
const userChannelId: string = (
    (await client.callUnknown("conversations.open", {
        users: selfUserInfo.user_id,
    })) as any
).channel.id;

console.log(`Logged in as ${selfUserInfo.user} (${selfUserInfo.user_id})`);

let websocketUrl: string = `wss://wss-primary.slack.com/?token=${client.token}&sync_desync=1&slack_client=desktop&start_args=?agent=client&org_wide_aware=true&eac_cache_ts=true&cache_ts=0&name_tagging=true&only_self_subteams=true&connect_only=true&ms_latest=true&no_query_on_subscribe=1&flannel=3&lazy_channels=1&gateway_server=T09V59WQY1E-1&enterprise_id=E09V59WQY1E&batch_presence_aware=1`;

let ws: WebSocket | undefined;
let reconnectTimer: Timer | undefined;

async function chatPostEphemeral(channel: string, text: string, thread_ts?: string, blocks?: any[], user?: string) {
    fetch("https://slack.com/api/chat.postEphemeral", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${SLACK_XOXP}`,
            "Content-Type": "application/json;charset=utf-8",
        },
        body: JSON.stringify({
            channel,
            text,
            thread_ts,
            blocks,
            user: user ?? selfUserInfo.user_id,
        }),
    })
        .then((res) => res.json())
        .then((data) => {
            if (!(data as any).ok) {
                console.error("Error posting ephemeral message:", data);
            }
        })
        .catch((err) => {
            console.error("Error posting ephemeral message:", err);
        });
}

type UserInfo = {
    type: "user";
    id: string;
    userId: string;
    displayName: string;
    pronouns: string;
    imageUrl: string;
};

async function getUserInfo(userId: string): Promise<UserInfo> {
    return fetch(`https://cachet.dunkirk.sh/users/${userId}`)
        .then((res) => res.json())
        .then((data) => data as UserInfo);
}

const context: BotContext = {
    client,
    selfUserId: selfUserInfo.user_id,
    userChannelId,
    workspace: SLACK_WORKSPACE,
    commands: COMMANDS,
    chatPostEphemeral,
};

function connect() {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
        return;
    }

    ws = new WebSocket(websocketUrl, {
        headers: {
            Cookie: `d=${SLACK_COOKIE}`,
        },
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
                        await trigger.any(msg, data.reaction, context);
                    } else if (data.user === selfUserInfo.user_id && trigger.me) {
                        await trigger.me(msg, data.reaction, context);
                    }
                }
                break;

            case "message":
                if (data.subtype === "me_message" && data.user === selfUserInfo.user_id) {
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
                        await commandDef.handler(msg, args, context);
                    }
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
