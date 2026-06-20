# JojoClient User Documentation Index

## Overview

JojoClient is a modern Minecraft launcher that simplifies managing profiles, installing mods, and playing Minecraft. This documentation explains each feature in user-friendly terms without technical jargon.

**All documentation files are written for people with no coding experience.**

## Documentation Files

### 🚀 Getting Started
**[Getting Started Guide](USER_GUIDE_GETTING_STARTED.md)**
- First-time setup walkthrough
- Basic concepts explained
- Initial profile creation
- First game launch
- Troubleshooting common issues

**Start here if you're new to JojoClient!**

---

## Core Features

### 🔐 Authentication
**[Authentication Guide](USER_GUIDE_AUTHENTICATION.md)**
- Account login explained
- How Microsoft login works
- Security and encryption basics
- Multiple accounts
- What happens to your data

**Key Concept**: Authentication lets you log into your Microsoft account securely.

---

### 📦 Profiles
**[Profiles Guide](USER_GUIDE_PROFILES.md)**
- What profiles are (game setups)
- Template vs. Installation explained
- Creating and managing profiles
- Why profiles matter
- Profile duplication and deletion

**Key Concept**: Profiles are like game configurations - each has its own mods and settings.

---

### 🎮 Game Launcher
**[Launcher Guide](USER_GUIDE_LAUNCHER.md)**
- How the game starts
- Java configuration
- Memory (RAM) settings
- Window size configuration
- What happens before/after launch
- Crash recovery

**Key Concept**: The launcher handles all the complex setup so you just click Play.

---

### 🔨 Mods
**[Mods Guide](USER_GUIDE_MODS.md)**
- What mods are (add-ons)
- Finding mods online
- Installing mods
- Mod dependencies
- Enabling and disabling mods
- Compatibility and conflicts

**Key Concept**: Mods add features to Minecraft - JojoClient makes managing them easy.

---

### 📌 Versions
**[Versions Guide](USER_GUIDE_VERSIONS.md)**
- Minecraft versions explained
- Fabric loader versions
- Version compatibility
- Downloading versions
- Choosing the right version
- Storage considerations

**Key Concept**: Different Minecraft versions have different features - choose based on your needs.

---

### 💾 Export & Import
**[Export/Import Guide](USER_GUIDE_EXPORT_IMPORT.md)**
- Backing up profiles
- Sharing profiles with friends
- Moving profiles between computers
- What gets exported
- What doesn't get exported

**Key Concept**: Export creates a backup file you can share or restore anytime.

---

### 🔄 Auto-Update
**[Auto-Update Guide](USER_GUIDE_AUTO_UPDATE.md)**
- How updates work
- Automatic download and install
- What's preserved during updates
- Manual updates if needed
- Safety and verification

**Key Concept**: JojoClient automatically keeps itself updated with new features and fixes.

---

## Feature Relationships

### How Features Work Together

```
1. You Log In (Authentication)
   ↓
2. Create a Profile (Profiles)
   ↓
3. Choose Minecraft & Fabric Versions (Versions)
   ↓
4. Add Mods to Profile (Mods)
   ↓
5. Create Installation from Profile (Profiles)
   ↓
6. Download Game Files (Launcher)
   ↓
7. Click Play (Launcher)
   ↓
8. Enjoy Minecraft!
```

### Backup & Share
```
Profile → Export (Export/Import) → Share with friend or backup
       ↓
Friend/New Computer → Import → Same profile ready to play
```

### Keeping Updated
```
JojoClient Running → Auto-Update Checks (Auto-Update)
                 ↓
          New Version Available?
                 ↓
        Download & Install Update
                 ↓
         Settings & Profiles Preserved
```

---

## Common Workflows

### "I want to play vanilla Minecraft"

1. Follow Getting Started
2. Create a profile with default settings
3. Create an installation
4. Click Play

**Guides needed**: Getting Started, Profiles, Launcher

---

### "I want to add mods"

1. Have a profile created
2. Go to Mods tab
3. Search for mods you want
4. Add them to the profile
5. Create or update installation
6. Play

**Guides needed**: Mods, Profiles, Launcher

---

### "I'm switching computers"

1. Export profile on Computer A
2. Move the export file to Computer B
3. Import the profile on Computer B
4. Create new installation
5. Play on new computer

**Guides needed**: Export/Import, Profiles, Launcher

---

### "I want to try different mod combinations"

1. Export your current profile (backup)
2. Disable some mods or add new ones
3. Create new installation to test
4. If it doesn't work, keep the backup to restore

**Guides needed**: Mods, Profiles, Export/Import

---

### "The game won't start"

1. Check Java is installed (Launcher guide)
2. Verify mods are compatible (Mods guide)
3. Check memory settings (Launcher guide)
4. Try disabling half your mods to find the culprit

**Guides needed**: Launcher, Mods

---

## Quick Reference

| What You Want | Where to Go | Time Needed |
|---------------|-------------|-------------|
| Play vanilla Minecraft | Getting Started | 10-15 min |
| Add mods to profile | Mods Guide | 5-30 min |
| Back up profile | Export/Import Guide | 2-5 min |
| Share profile with friend | Export/Import Guide | 5-10 min |
| Move to new computer | Export/Import + Getting Started | 20-30 min |
| Fix Java issues | Launcher Guide | 10-20 min |
| Choose Minecraft version | Versions Guide | 5-10 min |

---

## Understanding Key Concepts

### The 3-Layer Model

**Layer 1: Profile**
- What you configure
- Your mods, settings, version choices
- Stored in one place

**Layer 2: Installation**
- A copy of the profile for actual play
- Each has its own world saves
- Can create multiple from one profile

**Layer 3: Game Instance**
- What you actually play
- Runs when you click "Play"
- Uses the installation's settings

---

### Storage Explained

**Installation Space**
- Minecraft files: 1-3 GB per version
- Mods: 1-100 MB each
- Worlds: 100 MB - 1 GB+ each

**Profile Space**
- Mods: 1-100 MB each
- Configs: Small, usually under 10 MB

**Total Estimate**
- Vanilla only: 2-3 GB
- With mods: 3-10+ GB
- Multiple profiles: 10-50+ GB

---

## Troubleshooting Flowchart

**Game won't start?**
1. Check Java installed → Launcher Guide
2. Check mods compatible → Mods Guide
3. Check memory allocated → Launcher Guide
4. Disable half mods and retry → Mods Guide

**Mods not working?**
1. Check Minecraft version compatible → Versions/Mods Guide
2. Check for conflicts → Mods Guide
3. Verify they're enabled → Mods Guide
4. Check dependencies installed → Mods Guide

**Out of storage?**
1. Delete old installations → Profiles Guide
2. Delete old profiles → Profiles Guide
3. Export and archive old profiles → Export/Import Guide

**Lost profile?**
1. Check backup export files → Export/Import Guide
2. Import from backup → Export/Import Guide

---

## Important Safety Tips

1. **Back up important profiles regularly** - Use Export
2. **Test mods carefully** - Add a few at a time
3. **Keep Java updated** - Required for game to run
4. **Don't disable auto-updates** - Gets important fixes
5. **Verify mods are compatible** - Before spending time playing

---

## Where to Get More Help

### In the App
- Hover over buttons for tooltips
- Look for help icons (?)
- Error messages usually explain problems

### Online
- Minecraft forums
- Fabric Discord
- Mod creator documentation (links in mod descriptions)
- JojoClient issue tracker

### These Guides
- Search this documentation for your issue
- Follow the flowcharts for common problems
- Read the specific feature guide relevant to your issue

---

## File Organization

The documentation is organized as:

- **USER_GUIDE_GETTING_STARTED.md** - Read this first
- **USER_GUIDE_AUTHENTICATION.md** - Account management
- **USER_GUIDE_PROFILES.md** - Profile management
- **USER_GUIDE_LAUNCHER.md** - Starting the game
- **USER_GUIDE_MODS.md** - Mod management
- **USER_GUIDE_VERSIONS.md** - Version selection
- **USER_GUIDE_EXPORT_IMPORT.md** - Backup and sharing
- **USER_GUIDE_AUTO_UPDATE.md** - Keeping JojoClient updated

Each file is self-contained and can be read independently.

---

## What's NOT in This Documentation

- **Code or technical implementation** - No programming details
- **Troubleshooting advanced users** - No mod development topics
- **Operating system specific steps** - Focused on JojoClient only
- **Game strategy** - Not about how to play Minecraft, just how to use the launcher

---

## Document Quality Standards

All documentation is written:
- ✅ For complete beginners
- ✅ With real-world examples
- ✅ Using simple language
- ✅ With visual aids (tables, examples)
- ✅ With step-by-step instructions
- ✅ With troubleshooting sections
- ✅ Without technical jargon

---

## Feedback

If you find:
- Unclear explanations
- Missing information
- Incorrect information
- Confusing examples

Please report it so the guides can be improved!

---

## Happy Gaming! 🎮

Start with the Getting Started guide and explore from there. Each guide stands alone but references others when needed.

Enjoy playing Minecraft with JojoClient!

