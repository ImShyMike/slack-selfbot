# slack-selfbot

My silly selfbot for Slack that does some rather silly things :P

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
