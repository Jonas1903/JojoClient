# Profiles - Game Configuration Guide

## What It Does

Profiles let you organize and save different Minecraft game setups. Think of a profile as a "saved configuration" that remembers all your mods, settings, and preferences for a specific type of game you want to play.

## How It Works

### Creating a Profile

When you create a profile, you're creating a container that will hold:
- Your chosen Minecraft version (like 1.21.4)
- Your chosen Fabric loader version (the mod system)
- Mods you install (optional)
- Game settings and configs
- Resource packs and shader packs (optional)

### Profile Structure

Each profile has:

1. **A Template** - A master copy of all your settings and configurations
   - This is like a blueprint that gets copied when you want to play
   - Changes you make in-game automatically save back to the template
   - So your settings are remembered for next time

2. **Installations** - Individual game instances created from the template
   - When you play, you're actually running an "installation" (a copy of the template)
   - Multiple installations from the same profile can exist at the same time
   - Each installation is independent - changes in one don't affect others

## Using Profiles

### Setting Up a Profile

1. Create a new profile with a name (like "Vanilla Survival" or "Modded Creative")
2. Choose your Minecraft version
3. Choose your Fabric loader version
4. Start adding mods (optional)
5. Create an installation to start playing

### Playing with a Profile

1. Select the installation you want to play with
2. Click Play
3. JojoClient downloads or prepares everything needed
4. Minecraft opens and you can play
5. When you exit, your game settings automatically save to the profile template

### What Happens to Your Saves

- Your world saves are stored in each installation's game folder
- They're NOT stored in the profile template
- Each installation keeps its own separate worlds
- If you create two installations from the same profile, they have separate worlds

## Key Differences: Profile vs Installation

| Profile | Installation |
|---------|--------------|
| A template/blueprint | An actual game instance |
| Stores mods and configs | Stores worlds and game files |
| You create one profile | You can create many installations from one profile |
| Changes in-game save back to it | Has its own copy of everything |

## Example Scenario

**Profile: "Vanilla Survival"**
- Minecraft version: 1.21.4
- No mods
- Template has your game settings saved

From this profile, you create two installations:

1. **Installation: "Survival World 1"** - Playing with friends, has your castle and farms
2. **Installation: "Survival World 2"** - Single player hardcore mode, different world

Each installation is completely separate. You can play either one, and they don't interfere with each other.

## Profile Management

### Duplicating a Profile

You can copy an existing profile as a starting point. This copies:
- All mods
- All settings
- The template configuration

Then you can modify the copy however you want.

### Deleting a Profile

When you delete a profile, you delete:
- The template
- ALL installations created from that profile
- ALL world saves in those installations

**This cannot be undone**, so be careful!

### Exporting a Profile

You can export a profile to share with friends or backup on another computer. This creates a file that contains:
- All mods
- All configurations
- Your game settings

You can then import this on another computer to recreate the exact same setup.

## Tips for Organization

- **Name them clearly** - Use names like "1.21 Vanilla", "Creative Testing", "Modpack Name"
- **One profile per style** - Keep survival separate from creative separate from modpacks
- **Backup important profiles** - Export them if you spent time setting them up
- **Delete old profiles** - If you're not using a profile anymore, delete it to save space

## Storage

Profiles are stored on your computer in a location you choose. All mods, configs, and world saves take up storage space, so:
- Large mod lists use more storage
- Many installations use more storage
- You can move your profiles folder to a bigger drive if you run out of space

