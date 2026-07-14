#!/usr/bin/env bun

import { SlackClient } from "slack-undoc-client";
import type { BotContext, Command, MessageMetadata, ReactionTrigger, ShallowMessageMetadata, UserInfo } from "./types";

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
const LOG_EVENTS = process.env.LOG_EVENTS === "true";

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

async function getMessages(channel: string, ts_list: string[]): Promise<MessageMetadata[] | null> {
    const response = await client.messagesList({
        message_ids: JSON.stringify([{ channel, timestamps: ts_list }]),
        org_wide_aware: true,
        cached_latest_updates: "{}",
    });

    const messages = response.messages_data[channel as keyof typeof response.messages_data]?.messages;
    if (!messages) return null;

    return messages.map((msg) => ({
        ...msg,
        channel,
    }));
}

async function getMessage(channel: string, ts: string): Promise<MessageMetadata | null> {
    const messages = await getMessages(channel, [ts]);
    if (!messages || messages.length === 0) return null;
    return messages[0] ?? null;
}

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
            if (
                !(data as any).ok &&
                (data as any).error !== "restricted_action" &&
                (data as any).error !== "invalid_blocks"
            ) {
                console.error(`Error posting ephemeral message:`, data);
            }
        })
        .catch((err) => {
            console.error("Error posting ephemeral message:", err);
        });
}

async function sendFile(
    channel: string,
    filename: string,
    content: string,
    snippetType?: string,
    blocks?: any[],
): Promise<void> {
    const body = new Blob([content], { type: "application/octet-stream" });
    const uploadData = await client.filesGetUploadURL({
        filename,
        length: body.size,
        snippet_type: snippetType,
    });

    const uploadResponse = await fetch(uploadData.upload_url, {
        method: "POST",
        body,
    });
    if (!uploadResponse.ok) {
        const responseBody = await uploadResponse.text();
        throw new Error(
            `Failed to upload file contents: ${uploadResponse.status} ${uploadResponse.statusText}${responseBody ? `: ${responseBody}` : ""}`,
        );
    }

    await client.filesCompleteUpload({
        files: JSON.stringify([{ id: uploadData.file, title: filename }]),
    });
    await client.filesShare({
        files: uploadData.file,
        channel,
        broadcast: false,
        blocks: JSON.stringify(blocks ?? []),
    });
}

async function getUserInfo(userId: string): Promise<UserInfo> {
    return fetch(`https://cachet.dunkirk.sh/users/${userId}`)
        .then((res) => res.json())
        .then((data) => data as UserInfo);
}

async function getChannelName(channelId: string): Promise<string | null> {
    return fetch(`https://flaron.halceon.dev/cid/${channelId}`)
        .then((res) => res.json())
        .then((data) => (data as any).name);
}

async function getChannelNames(channelIds: string[]): Promise<(string | null)[]> {
    const dedupedIds = [...new Set(channelIds)];
    const namesById = new Map(await Promise.all(dedupedIds.map(async (id) => [id, await getChannelName(id)] as const)));

    return channelIds.map((id) => namesById.get(id) ?? null);
}

const ctx: BotContext = {
    client,
    selfUserId: selfUserInfo.user_id,
    userChannelId,
    workspace: SLACK_WORKSPACE,
    commands: COMMANDS,
    chatPostEphemeral,
    getMessages,
    getMessage,
    getUserInfo,
    getChannelName,
    getChannelNames,
    sendFile,
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

    const handleMessage = async (event: MessageEvent) => {
        let data: any;
        try {
            data = JSON.parse(event.data);
        } catch (err) {
            console.error("Failed to parse websocket message:", err);
            return;
        }

        if (LOG_EVENTS) {
            console.log("Received event:", data.type);
            await Bun.write(`./event_logs/${data.type}.json`, JSON.stringify(data, null, 2));
            return;
        }

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
                    if (trigger.resolveMessage) {
                        const msg = await getMessage(data.item.channel, data.item.ts);
                        if (!msg) {
                            console.error("Failed to resolve message for reaction trigger:", data.reaction);
                            chatPostEphemeral(data.item.channel, "Message not found", data.item.thread_ts);
                            return;
                        }
                        if (trigger.any) {
                            await trigger.any(msg, ctx);
                        } else if (data.user === selfUserInfo.user_id && trigger.me) {
                            await trigger.me(msg, ctx);
                        }
                    } else {
                        const msg: ShallowMessageMetadata = {
                            ts: data.item.ts,
                            channel: data.item.channel,
                            user: data.user,
                        };
                        if (trigger.any) {
                            await trigger.any(msg, ctx);
                        } else if (data.user === selfUserInfo.user_id && trigger.me) {
                            await trigger.me(msg, ctx);
                        }
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
                        type: data.type,
                        text: messageText,
                        blocks: data.blocks,
                        ts: data.ts,
                        channel: data.channel,
                        user: data.user,
                        thread_ts: data.thread_ts,
                    };

                    const commandDef = COMMANDS[command];
                    if (commandDef) {
                        if (commandDef.args && args.length === 0) {
                            await chatPostEphemeral(
                                data.channel,
                                `Usage: \`${command} ${commandDef.args}\``,
                                data.thread_ts,
                            );
                            return;
                        }
                        await commandDef.handler(msg, args, ctx);
                    } else {
                        await chatPostEphemeral(
                            data.channel,
                            `Unknown command: \`${command}\`. Use \`help\` to see available commands.`,
                            data.thread_ts,
                        );
                    }
                }
                break;

            default:
                // console.log("Received unknown event:", data.type);
                // await Bun.write(
                //     `./event_logs/${data.type}.json`,
                //     JSON.stringify(data, null, 2),
                // );
                break;
        }
    };

    ws.addEventListener("message", (event) => {
        void handleMessage(event).catch(async (err) => {
            console.error("Error handling websocket message:", err);
            const filename = `error_${Date.now()}.txt`;
            await sendFile(userChannelId, filename, err.stack ?? String(err), "text", [
                {
                    type: "rich_text",
                    elements: [
                        {
                            type: "rich_text_section",
                            elements: [{ type: "text", text: "Something crashed :(" }],
                        },
                    ],
                },
            ]);
        });
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
