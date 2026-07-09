# slack-selfbot

My silly selfbot for Slack that does some rather silly things :P

## What does it do?

- Lets you run selfbot commands by using `/me` messages
- Supports these commands:
  - `help [command]` - show available commands or details for one command
  - `ping` - check whether the selfbot is alive
  - `echo <text>` - send a normal message as yourself with mrkdwn support
  - `id <@user|#channel|@usergroup>` - gets the SLack ID from the provided parameter
- Watches for a couple reaction shortcuts:
  - `:i-would-ooc-this-but-i-cant:` - DMs you every time someone reacts to a message with it
  - `:private:` - gives you the name of the private channel

## Setup

Slack user token:

- Go to [https://api.slack.com/apps](https://api.slack.com/apps)
- Click "Create New App"
- Click "From a manifest"
- Select the workspace you want to install the selfbot in
- Paste the contents of `manifest.json`
- Click "Next" and then "Create"
- Head over to "Install app" under "Settings"
- Click "Install to Workspace" and then "Allow"
- Copy the "User OAuth Token" and paste it into `.env` as `SLACK_XOXP`

Slack selfbot cookie:

- Open the Slack web app in your browser
- Open the developer tools (usually F12 or right click then Inspect)
- Go to the "Storage" tab and then "Cookies"
- Click on "https://app.slack.com" and find the cookie named "d"
- Copy the value of the cookie and paste it into `.env` as `SLACK_COOKIE`

You're done! :D

## Usage

Install dependencies:

```bash
bun install
```

Run the selfbot:

```bash
bun index.ts
```
