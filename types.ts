import type { SlackClient } from "slack-undoc-client";

export type MessageMetadata = {
    text: string;
    blocks: any[];
    ts: string;
    channel: string;
    user: string;
    thread_ts?: string;
};

export type ShallowMessageMetadata = {
    ts: string;
    channel: string;
    user: string;
    thread_ts?: string;
};

export type BotContext = {
    client: SlackClient;
    selfUserId: string;
    userChannelId: string;
    workspace: string;
    commands: Record<string, Command>;
    chatPostEphemeral: (
        channel: string,
        text: string,
        thread_ts?: string,
        blocks?: any[],
        user?: string,
    ) => Promise<void> | void;
};

export type Command = {
    name: string;
    description: string;
    args?: string;
    handler: (msg: MessageMetadata, args: string[], context: BotContext) => Promise<void>;
};

export type ReactionTrigger = {
    name: string;

    /**
     * Only triggers when the reaction is added by the selfbot user
     */
    me?: (msg: ShallowMessageMetadata, reaction: string, context: BotContext) => Promise<void>;

    /**
     * Triggers when the reaction is added by any user (including the selfbot user)
     */
    any?: (msg: ShallowMessageMetadata, reaction: string, context: BotContext) => Promise<void>;
};
