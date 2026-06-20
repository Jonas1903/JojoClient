# Authentication - Account Login Guide

## What It Does

The Authentication feature lets you log into JojoClient using your Microsoft/Xbox account. This is the same account you use to log into Minecraft Java Edition on the official launcher.

## How It Works

When you log in:

1. **You Connect to Your Account** - JojoClient opens a login window where you enter your Microsoft email and password (this happens on Microsoft's secure servers, not in JojoClient)

2. **Automatic Verification** - After you log in, JojoClient gets permission to use your Minecraft profile without storing your password

3. **Your Account Info is Stored** - JojoClient saves your account information locally on your computer in an encrypted way so you don't have to log in every time you open the launcher

4. **Game Launch** - When you play, your account information is automatically sent to Minecraft so the game knows who you are

## Key Points to Know

- **No Password Storage** - Your password is NEVER saved. JojoClient only keeps encrypted tokens that prove you're logged in
- **Multiple Accounts** - You can have multiple Microsoft accounts logged in and switch between them
- **Security** - Everything is encrypted on your computer and only your computer can decrypt it
- **Expiration** - Your login automatically refreshes before it expires, so you won't get kicked out while playing
- **Switching Accounts** - You can log out and log in with a different Microsoft account anytime

## What Happens When You Log In

1. Your username and profile ID are saved
2. A unique identifier (UUID) is stored so the game knows exactly which account is playing
3. Your Xbox/Games Pass status is checked so Minecraft knows you own the game

## Why You Need This

Without logging in, you can't:
- Play the game
- Use any game features that need your account
- Download and play mods with profiles

## Security Notes

- Your login information is stored only on your computer
- The encryption is strong enough that only your computer can read it
- Even if someone gets access to the files, they can't use your account
- Each computer you use has its own encrypted copy of your login

## Troubleshooting

**"I can't log in"**
- Make sure you have internet connection
- Make sure your Microsoft account password is correct
- Try logging in on the official Microsoft website first to confirm your account works

**"I'm logged out"**
- This rarely happens, but if it does, just log in again - JojoClient will remember your choice to stay logged in

**"I want to use a different account"**
- Log out from Settings, then log in with the new Microsoft account

