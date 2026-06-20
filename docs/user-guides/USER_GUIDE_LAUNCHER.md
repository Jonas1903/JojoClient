# Game Launcher - Starting Your Game Guide

## What It Does

The Game Launcher handles everything needed to start playing Minecraft:
- Prepares all game files
- Configures Java (the program that runs Minecraft)
- Sets up memory usage
- Handles mods and settings
- Actually starts the game

## How It Works

### Before Launch

When you click **Play**, several things happen automatically:

1. **Version Check** - JojoClient verifies you have the right Minecraft version
2. **Mod Sync** - Mods are updated and checked for compatibility
3. **File Download** - Any missing game files are downloaded
4. **Java Detection** - JojoClient finds the correct Java installation
5. **Memory Configuration** - Sets how much RAM the game can use
6. **Game Folder Setup** - Prepares your world saves and settings

### Starting the Game

Once everything is ready:
1. Java is started with the correct settings
2. Minecraft loads with all your mods and settings
3. The Minecraft window opens
4. You can log in and play

### After You Exit

When you close Minecraft:
1. Your game settings are automatically saved
2. These settings are copied back to your profile template
3. Next time you play, your settings are remembered

## Java Configuration

### What is Java?

Java is the programming language Minecraft is written in. To play Minecraft, you need Java installed on your computer.

### Finding Java

JojoClient automatically looks for Java in common installation locations:
- Program Files / Program Files (x86)
- Common JDK (Java Development Kit) installation directories

If it can't find Java, you'll see an error and need to install it.

### Java Versions

Different Minecraft versions need different Java versions:
- **Minecraft 1.21+** needs Java 21
- **Minecraft 1.18-1.20** needs Java 17
- **Minecraft 1.17** needs Java 16 (but Java 17 works too)

JojoClient automatically picks the right Java version for your Minecraft version.

## Memory Configuration

### What is Memory (RAM)?

Memory is how much of your computer's RAM Minecraft can use. More memory = better performance, but it also uses resources other programs need.

### Default Settings

JojoClient automatically calculates good memory settings based on:
- Your Minecraft version
- Your mods (more mods = more memory needed)
- Your system's total RAM

Default usually assigns:
- **Minimum**: 512 MB to 2 GB (base amount always available to the game)
- **Maximum**: 4-8 GB (or more, depending on your system)

### Changing Memory

You can manually adjust memory in **Settings**:
- **Higher values** (8+ GB) - Good for heavy modpacks, large render distances
- **Lower values** (2-4 GB) - Good for vanilla, light mods, older computers

**Rule of thumb**: Leave at least 2 GB of RAM free for your operating system and other programs.

## Game Directory

### Where Your Saves Are

The game directory is where all your:
- World saves
- Player data
- Settings
- Options
- Mods

Are stored.

By default, this is inside your profile's installation folder. You can change this if you want to store saves elsewhere.

## Window Size

You can configure how big the Minecraft window is:
- **Width** and **Height** - Set custom window size
- **Fullscreen** - Play in fullscreen mode

Your choice is saved and remembered for next time.

## Troubleshooting

### Game Won't Start

| Issue | Solution |
|-------|----------|
| "Java not found" | Install Java 17 or 21 from adoptium.net |
| "Not enough memory" | Close other programs or increase RAM allocation |
| Game crashes immediately | Check mod compatibility, try disabling half your mods |
| Mods not loading | Make sure they're enabled and compatible with your MC version |

### Game Runs Slowly

- **Increase memory** - Set max memory to 8 GB if your computer has it
- **Reduce mods** - Some mods use lots of resources
- **Lower render distance** - Reduces how far you can see (saves memory)
- **Disable shaders** - Fancy graphics use extra resources

### Game Freezes

- **Out of memory** - Increase RAM allocation
- **Mod conflict** - Disable recently added mods
- **Resource pack issue** - Try without custom resource packs

## Launch Safety Features

### Auto-Restart on Crash

If the game crashes within 90 seconds of starting, JojoClient automatically:
1. Re-checks your mods
2. Disables incompatible ones
3. Fixes known configuration issues
4. Tries launching again (up to 2 times)

This helps recover from one-time crashes.

### Settings Preservation

Your in-game settings (controls, graphics, etc.) are preserved by:
- Copying them back to your profile after you exit
- Restoring them when you play with the same profile again
- So your preferences are remembered between sessions

## Performance Tips

1. **Allocate enough memory** - Not too little (game lags) and not too much (system freezes)
2. **Keep mods updated** - Old mods might be inefficient
3. **Use compatible mods** - Check that mods work together
4. **Regular maintenance** - Remove unused mods to reduce load time
5. **Close background apps** - Free up system resources for the game

## System Requirements

**Minimum to Play**:
- Java 17 or 21 installed
- 2 GB RAM free (4 GB recommended)
- Internet connection for first-time setup
- About 5-10 GB free storage (more with modpacks)

**For Good Performance with Mods**:
- Java 21
- 8 GB RAM minimum
- 20+ GB free storage
- Decent CPU and graphics card

