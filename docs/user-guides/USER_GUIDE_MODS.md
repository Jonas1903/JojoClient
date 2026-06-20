# Mods - Add-ons and Enhancements Guide

## What It Does

Mods (modifications) are add-ons that change or enhance Minecraft. The Mods feature lets you:
- Search for mods online
- Download and install mods into your profile
- Enable or disable mods without deleting them
- Automatically download mods that other mods depend on

## How Mods Work

### Mod Basics

A mod is a file (usually a `.jar` file) that adds new features to Minecraft. Examples:
- New items and blocks
- New creatures and biomes
- Quality-of-life improvements
- Performance improvements
- Utility tools

### Mod System (Fabric)

JojoClient uses the Fabric mod system, which is like a "translation layer" that lets mods safely add features to Minecraft without breaking the game.

## Using Mods

### Finding Mods

1. Go to the **Mods** tab
2. Use the **Search** feature to find mods on Modrinth (a mod website)
3. Browse through results to find what you want
4. Click a mod to see:
   - Description of what it does
   - What version of Minecraft it supports
   - Compatibility information
   - Download count and popularity

### Installing a Mod

When you install a mod into a profile:

1. JojoClient downloads the mod file
2. It checks for "dependencies" (other mods this mod needs to work)
3. If dependencies are missing, JojoClient automatically downloads them too
4. Everything is added to your profile's mod folder

### Enabling and Disabling Mods

- **Enable**: Mod is active when you play the game
- **Disable**: Mod is kept but not active when you play

You can disable a mod without deleting it - useful if you want to test if a mod is causing problems.

### Mod Dependencies

Some mods require other mods to work. For example:
- A "chairs" mod might need a "furniture library" mod first
- A "magic weapons" mod might need a "magic system" mod

When you install a mod with dependencies, JojoClient automatically:
1. Detects what's needed
2. Downloads the required mods
3. Installs them too

**You don't have to do anything** - it happens automatically.

## Managing Your Mods

### Your Mods Tab

Shows all mods installed in the current profile. You can:
- See which mods you have
- See their versions
- Enable or disable them
- Delete them

### Mod Compatibility

Mods need to be compatible with:
- **Minecraft Version** - A mod made for 1.20 might not work in 1.21
- **Fabric Version** - Different versions of Fabric support different things
- **Other Mods** - Some mods conflict with each other

JojoClient warns you if there are compatibility problems:
- Shows an orange warning if there are issues
- Automatically disables conflicting mods if it detects problems
- Lets you know which mods are causing the issue

### What's a Mod Issue?

If JojoClient detects a problem with your mods, it shows this in the installation info. Issues can be:
- **Missing dependency** - A mod needs another mod that isn't installed
- **Incompatible version** - A mod isn't compatible with your Minecraft version
- **Conflict** - Two mods are fighting with each other

When you have issues:
1. Install the missing mods
2. Update mods to compatible versions
3. Remove conflicting mods
4. Re-launch the game

JojoClient will warn you before launching if there are issues.

## How Mods Get Into Your Game

When you click **Play**:

1. JojoClient checks what mods you have enabled
2. It copies all enabled mods into the game's mod folder
3. It checks that everything is compatible
4. It disables any incompatible mods automatically
5. It launches the game with all compatible mods loaded

### Sync Process

Before every game launch, JojoClient "syncs" your mods:
- Updates the game folder with your current mod list
- Verifies all mod files are correct
- Checks for conflicts
- Fixes problems if possible

This ensures your mods are always in the right state when you play.

## Tips for Using Mods

### Keep Mods Updated

- Mod developers release updates for new Minecraft versions
- Outdated mods might not work correctly
- Check for updates periodically

### Start Small

- Add a few mods at a time
- Test to make sure they work together
- If the game crashes, you'll know which mod caused it

### Read the Description

Before downloading a mod:
- Check which Minecraft versions it supports
- Look for any warnings or known issues
- See if it needs other mods (dependencies)

### Common Mod Issues

| Problem | Solution |
|---------|----------|
| Game won't start | Disable half your mods and try again to find which one is broken |
| Game is very slow | Some mods use more resources - remove heavy ones |
| Mods aren't working | Make sure they're enabled and compatible with your Minecraft version |
| Mod file is corrupted | Delete and re-download it |

### Storage Considerations

- Each mod takes a small amount of space (usually 1-50 MB)
- A profile with 50 mods might use 1-2 GB of space
- Large modpacks can use significant storage

## Safety

- **Only download mods from trusted sources** - JojoClient uses Modrinth, which is a safe, trusted source
- **Mods are verified** - Downloaded mods are checked for integrity
- **Disable if broken** - If a mod causes problems, disable it or delete it
- **Backup before big changes** - Export your profile before major mod updates

