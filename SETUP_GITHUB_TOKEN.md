# How to Set GitHub Token for Publishing Updates

## Method 1: Temporary (Current Session Only) - Quick Test

### PowerShell:
```powershell
$env:GH_TOKEN="your_github_token_here"
```

### Command Prompt (CMD):
```cmd
set GH_TOKEN=your_github_token_here
```

**Note**: This only lasts for the current terminal session. When you close the terminal, you'll need to set it again.

---

## Method 2: Permanent (Recommended) - Set System Environment Variable

### Option A: Using Windows Settings (GUI)

1. Press `Win + R` to open Run dialog
2. Type: `sysdm.cpl` and press Enter
3. Click the **"Advanced"** tab
4. Click **"Environment Variables"** button
5. Under **"User variables"** (or **"System variables"**), click **"New"**
6. Variable name: `GH_TOKEN`
7. Variable value: `your_github_token_here`
8. Click **OK** on all dialogs
9. **Restart your terminal/IDE** for changes to take effect

### Option B: Using PowerShell (Run as Administrator)

```powershell
# Set for current user (recommended)
[System.Environment]::SetEnvironmentVariable('GH_TOKEN', 'your_github_token_here', 'User')

# Or set for all users (requires admin)
[System.Environment]::SetEnvironmentVariable('GH_TOKEN', 'your_github_token_here', 'Machine')
```

**Note**: After setting, restart your terminal/IDE.

### Option C: Using Command Prompt (Run as Administrator)

```cmd
setx GH_TOKEN "your_github_token_here" /M
```

**Note**: 
- `/M` sets it system-wide (requires admin)
- Remove `/M` to set it for current user only
- Restart terminal after running

---

## Method 3: Create a Setup Script (Easiest for Development)

Create a file `set-token.ps1`:

```powershell
# set-token.ps1
$token = Read-Host "Enter your GitHub token (input will be hidden)" -AsSecureString
$plainToken = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($token))
[System.Environment]::SetEnvironmentVariable('GH_TOKEN', $plainToken, 'User')
Write-Host "✅ Token saved! Restart your terminal for changes to take effect." -ForegroundColor Green
```

Then run it once:
```powershell
.\set-token.ps1
```

---

## Verify Token is Set

### PowerShell:
```powershell
echo $env:GH_TOKEN
```

### Command Prompt:
```cmd
echo %GH_TOKEN%
```

If it shows your token, it's set correctly!

---

## Getting Your GitHub Token

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Give it a name: `Electron Builder Publishing`
4. Select scopes:
   - ✅ **repo** (Full control of private repositories)
5. Click **"Generate token"**
6. **Copy the token immediately** (you won't see it again!)
7. Use this token as `your_github_token_here` above

---

## Security Best Practices

- ✅ Store token in environment variables (not in code)
- ✅ Use User-level environment variable (not System) unless needed
- ✅ Never commit tokens to git
- ✅ Regenerate token if accidentally exposed
- ✅ Use minimal permissions (only `repo` scope needed)

---

## Troubleshooting

### Token not working?
1. Verify token is set: `echo $env:GH_TOKEN`
2. Restart terminal/IDE after setting
3. Check token has `repo` permissions
4. Verify repository exists and you have access

### "GH_TOKEN not found" error?
- Make sure you set it before running `npm run publish`
- Restart terminal after setting environment variable
- Check spelling: `GH_TOKEN` (not `GITHUB_TOKEN`)
