import { SlackClient } from 'slack-undoc-client';

const SLACK_COOKIE = process.env.SLACK_COOKIE;
const SLACK_XOXP = process.env.SLACK_XOXP;

if (!SLACK_COOKIE) {
  throw new Error('SLACK_COOKIE environment variable is not set.');
} else if (!SLACK_XOXP) {
  throw new Error('SLACK_XOXP environment variable is not set.');
}

const client = await SlackClient.create({
    cookie: SLACK_COOKIE,
    workspace: 'hackclub',
})

const userInfo = await client.authTest();
const userChannelId: string = (await client.callUnknown("conversations.open", {
    users: userInfo.user_id,
}) as any).channel.id;

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

type MessageMetadata = {
    text: string;
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

function formatHelpText() {
    return Object.entries(COMMANDS)
        .map(([name, command]) => {
            const usage = command.args ? `*${name}* ${command.args}` : `*${name}*`;
            return `- ${usage}: ${command.description}`;
        })
        .join("\n");
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
                if (data.reaction === "i-would-ooc-this-but-i-cant") {
                    await client.chatPostMessage({
                        channel: userChannelId,
                        // @ts-ignore
                        text: `Waiter, waiter! One more <https://hackclub.slack.com/archives/${data.item.channel}/p${data.item.ts.replace(".","")}|OOC> please!`,
                    });
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
