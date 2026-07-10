import type { MessagesListResponse, SlackClient } from "slack-undoc-client";

type MessagesByChannel = MessagesListResponse["messages_data"];
type SlackMessage = MessagesByChannel[keyof MessagesByChannel]["messages"][number];

export type MessageMetadata = Omit<SlackMessage, "thread_ts"> & {
    channel: string;
    thread_ts?: SlackMessage["thread_ts"];
};

export type ShallowMessageMetadata = {
    ts: string;
    channel: string;
    user: string;
    thread_ts?: string;
};

export type UserInfo = {
    type: "user";
    id: string;
    userId: string;
    displayName: string;
    pronouns: string;
    imageUrl: string;
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
    getMessages: (channel: string, ts_list: string[]) => Promise<MessageMetadata[] | null>;
    getMessage: (channel: string, ts: string) => Promise<MessageMetadata | null>;
    getUserInfo: (userId: string) => Promise<UserInfo | null>;
    getChannelName: (channelId: string) => Promise<string | null>;
    getChannelNames: (channelIds: string[]) => Promise<(string | null)[]>;
};

export type Command = {
    name: string;
    description: string;
    args?: string;
    handler: (msg: MessageMetadata, args: string[], context: BotContext) => Promise<void>;
};

type ReactionCallback<T> = (msg: T, ctx: BotContext) => Promise<void>;

type ReactionTriggerBase<T, Resolve extends boolean> = {
    name: string;
    /**
     * Only triggers when the reaction is added by the selfbot user
     */
    me?: ReactionCallback<T>;
    /**
     * Triggers when the reaction is added by any user (including the selfbot user)
     */
    any?: ReactionCallback<T>;
} & (Resolve extends true ? { resolveMessage: true } : { resolveMessage?: false });

export type ReactionTrigger =
    ReactionTriggerBase<MessageMetadata, true> | ReactionTriggerBase<ShallowMessageMetadata, false>;
