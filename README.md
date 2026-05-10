# github-stats-card

Real-time GitHub stats card — self-hosted on Vercel. Generates a fresh SVG on every request using the GitHub GraphQL API.

---

## Deploy in 5 minutes

### Step 1 — Create a GitHub PAT

Go to: **GitHub → Settings → Developer Settings → Personal Access Tokens → Fine-grained tokens**

Permissions needed:
- `read:user`
- `public_repo` (read)

Copy the token.

### Step 2 — Push this repo to GitHub

```bash
git init
git add .
git commit -m "init: github stats card"
gh repo create github-stats-card --public --push
```

### Step 3 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your `github-stats-card` repo
3. Add these **Environment Variables**:
   - `GITHUB_TOKEN` → your PAT from Step 1
   - `GITHUB_USERNAME` → `techynikhil17`
4. Hit **Deploy**

Your endpoint will be:
```
https://your-deployment.vercel.app/api/stats
```

Test it in browser — you should see your live stats card SVG.

---

## Add to your GitHub README

Replace the `◈ SYSTEM METRICS` section in your profile README with:

```markdown
## ◈ SYSTEM METRICS

<div align="center">

<img src="https://your-deployment.vercel.app/api/stats" width="480" alt="Nikhil's GitHub Stats" />

</div>
```

That's it. Every time someone views your profile, GitHub fetches a fresh SVG from your Vercel function. Stats update every hour (cached for performance, fresh within 1 hour).

---

## What's tracked

| Metric | Source |
|--------|--------|
| Commits (last 30 days) | GitHub GraphQL API |
| Total stars | GitHub GraphQL API |
| Repo count | GitHub GraphQL API |
| Current streak | Computed from contribution calendar |
| Longest streak | Computed from contribution calendar |
| Total active days | Computed from contribution calendar |
| Rank (S/A+/A/B+/B/C) | Weighted score: commits + PRs + stars + followers |
| Contribution bar chart | Last 30 days, color-coded by streak |

---

## Customize

Edit `api/stats.js`:

- **Colors**: Change `#58a6ff` (blue) and `#f78166` (orange) to any hex
- **Tags**: Update the `INTELLIGENCE STACK` array with your own skills
- **Rank formula**: Tweak weights in `getRank()` 
- **Cache**: Change `s-maxage=3600` to any seconds value

---

## How it works

```
GitHub Profile README
  → loads <img src="https://your-vercel.app/api/stats">
    → Vercel serverless function runs
      → fetches GitHub GraphQL API (with your PAT)
        → computes streak, rank, stats
          → returns styled SVG
            → GitHub renders it inline
```

Zero dependencies. Pure Node.js fetch. Runs on Vercel's free tier indefinitely.
