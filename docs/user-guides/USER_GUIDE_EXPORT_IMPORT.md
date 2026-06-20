# Export & Import - Backup and Share Profiles Guide

## What It Does

Export and Import let you:
- **Export** - Create a file with a complete copy of a profile (mods, settings, configs)
- **Import** - Load a profile from that file on your computer or someone else's computer

This is useful for:
- Backing up important profiles
- Sharing modpacks with friends
- Moving profiles between computers
- Keeping a copy of a setup you spent time creating

## Exporting a Profile

### What Gets Exported?

When you export a profile, you get a file containing:
- **All mods** - Every mod you've installed
- **Game settings** - Video settings, controls, difficulty, etc.
- **Config files** - Special files that mods use to save their settings
- **Resource packs** - Custom textures if you have any
- **Shader packs** - Custom graphics if you have any
- **World settings data** - World-specific configuration (but NOT the actual worlds)

### What Doesn't Get Exported?

- **World saves** - Your actual games/worlds with progress
- **Player data** - Your playtime, achievements (those stay on your computer only)

**Why?** Worlds are huge and personal to each player. The export focuses on the setup and configuration.

### How to Export

1. Find the profile you want to export
2. Click "Export Profile"
3. Choose where to save the export file (your Desktop, Documents, etc.)
4. A `.zip` file is created (like `MyProfile-Export.zip`)

This usually takes a minute or two depending on how many mods you have.

### Export File Size

The export file size depends on your mods:
- **Vanilla profile** (no mods): 10-50 MB
- **Light mods** (5-10 mods): 50-200 MB
- **Moderate mods** (20-40 mods): 200 MB - 1 GB
- **Heavy modpack** (50+ mods): 1-3 GB

## Importing a Profile

### What Happens During Import

When you import a profile:
1. JojoClient reads the export file
2. Verifies everything is valid
3. Creates a new profile with the same name and settings
4. Extracts all mods and configs
5. Recreates the exact same setup

You end up with a profile that's identical to the one that was exported.

### How to Import

1. Get an export file (from a friend, backup, etc.)
2. In JojoClient, go to Profiles
3. Click "Import Profile"
4. Select the `.zip` export file
5. Choose the Minecraft and Fabric versions to use
6. Wait for everything to download and extract

### During Import

JojoClient will:
- Download any Minecraft versions needed
- Download any Fabric versions needed
- Extract mods into the right locations
- Set up all configurations

This can take several minutes depending on:
- Download speed
- Number of mods
- File size

### After Import

You'll have a new profile that:
- Has all the same mods
- Has all the same settings
- Needs a new installation to play with
- Is ready to use

## Use Cases

### Backing Up Important Profiles

1. Export a profile you spent time setting up
2. Save the export file somewhere safe (USB drive, cloud storage)
3. If something goes wrong, import it back

### Sharing with Friends

1. Export your modpack profile
2. Send the `.zip` file to your friend
3. They import it
4. You're both playing the same setup

### Multiple Computers

1. Export profile on Computer A
2. Copy the export file to Computer B
3. Import it on Computer B
4. Same profile on both computers

### Starting Over

If JojoClient gets corrupted or you reinstall Windows:
1. You have the export file as backup
2. Install JojoClient on the new system
3. Import your profiles back
4. Everything is restored

## Export File Contents

If you're curious, the `.zip` export file contains:

```
profile-export/
├── metadata.json (profile name, version info)
├── manifest.json (list of all files)
├── mods/ (all mod .jar files)
├── config/ (mod configuration files)
├── resourcepacks/ (custom texture files)
├── shaderpacks/ (custom graphics files)
└── options.txt (game settings)
```

The files are verified with SHA-256 hashes to ensure they haven't been modified.

## Sharing Profiles Safely

### Trusted Sources Only

Only import profiles from:
- Friends you know
- Modpack creators on trusted sites
- Your own backups

### Checking Files

Before importing, you can:
- Check the file size (should match what you expect)
- Extract the `.zip` to see what's inside
- Verify it contains expected mods

### After Importing

- Make sure the profile works before deleting the original
- Test in a creative world first if unsure
- Have a backup of the export file just in case

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Export fails | Make sure you have enough disk space |
| Export takes forever | Normal for large modpacks - be patient |
| Import fails | Make sure the file isn't corrupted, try again |
| Missing mods after import | Redownload them - the import should list what's missing |
| File size is wrong | The file might be corrupted - delete and try again |

## Storage Tips

- **Export regularly** - Back up important profiles every week or two
- **Label clearly** - Name exports like "Modpack-1.21-2024-01-15.zip"
- **Store backups** - Keep important exports on cloud storage or external drive
- **Check exports** - Periodically verify you can import them back

## File Format Details

Export files are standard `.zip` files that:
- Are compressed for smaller file size
- Can be opened with any ZIP program
- Use SHA-256 hashing for integrity verification
- Include a manifest so you know what's inside

You can manually extract a `.zip` export to manually inspect the contents if needed.

