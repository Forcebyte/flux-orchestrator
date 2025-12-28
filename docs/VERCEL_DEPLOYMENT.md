# Vercel Deployment Guide

This guide will help you deploy the Flux Orchestrator demo to Vercel in under 5 minutes.

## Prerequisites

- A [Vercel account](https://vercel.com/signup) (free tier works great!)
- Your Flux Orchestrator repository pushed to GitHub

## Step-by-Step Deployment

### 1. Push to GitHub

Make sure your code is pushed to GitHub:

```bash
git add .
git commit -m "Add demo mode for Vercel deployment"
git push origin main
```

### 2. Deploy to Vercel

#### Option A: Deploy Button (Fastest)

1. Click the deploy button in the [README.md](../README.md)
2. Connect your GitHub account
3. Select your repository
4. Vercel will auto-detect the configuration from `vercel.json`
5. Done! 🎉

#### Option B: Vercel Dashboard

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click "Import Project"
3. Select your GitHub repository
4. **Configure Project**:
   - **Framework Preset**: Other
   - **Root Directory**: Leave as `.` (root)
   - **Build Command**: Leave default (Vercel will use vercel.json)
   - **Output Directory**: Leave default (Vercel will use vercel.json)
5. **Environment Variables**:
   - Click "Add" under Environment Variables
   - **Name**: `VITE_DEMO_MODE`
   - **Value**: `true`
   - Select all environments (Production, Preview, Development)
6. Click "Deploy"

#### Option C: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy (from project root)
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? [Your account]
# - Link to existing project? No
# - Project name? flux-orchestrator-demo
# - In which directory is your code? ./
# - Want to override settings? No

# Set environment variable (only needed once)
vercel env add VITE_DEMO_MODE production
# Enter value: true

# Deploy to production
vercel --prod
```

### 3. Verify Deployment

Once deployed, you should see:

1. ✅ A demo banner at the top: "🎭 Demo Mode - All data is simulated"
2. ✅ 3 sample clusters in the dashboard
3. ✅ Sample Flux resources
4. ✅ Activity feed with recent actions
5. ✅ Dark/light theme toggle working

## Configuration Details

The deployment uses these files:

### `vercel.json`
```json
{
  "version": 2,
  "builds": [{
    "src": "frontend/package.json",
    "use": "@vercel/static-build",
    "config": { "distDir": "dist" }
  }],
  "routes": [
    { "src": "/assets/(.*)", "dest": "/assets/$1" },
    { "src": "/(.*)", "dest": "/index.html" }
  ],
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist"
}
```

### Environment Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_DEMO_MODE` | `true` | Enables demo mode with mock data |

## Customizing the Demo

### Change Mock Data

Edit `frontend/src/mockData.ts`:

```typescript
export const mockClusters: Cluster[] = [
  {
    id: 'your-cluster-1',
    name: 'Your Custom Cluster',
    description: 'Your description here',
    status: 'healthy',
    // ... other fields
  },
];
```

After editing, redeploy:

```bash
git add .
git commit -m "Update demo data"
git push origin main
# Vercel will auto-deploy
```

### Change Demo Banner

Edit `frontend/src/App.tsx` line ~125:

```tsx
{IS_DEMO_MODE && (
  <div style={{...}}>
    🎭 Your custom message here
  </div>
)}
```

### Disable Demo Banner

Set `VITE_DEMO_MODE` to `false` in Vercel environment variables, or remove the banner code.

## Domain Configuration

### Custom Domain

1. Go to your project in Vercel dashboard
2. Click "Settings" → "Domains"
3. Add your custom domain (e.g., `demo.yourcompany.com`)
4. Follow DNS configuration instructions
5. Wait for DNS propagation (usually < 1 hour)

### Subdomain

Vercel provides a free subdomain like:
- `flux-orchestrator-demo.vercel.app`
- `your-username-flux-orchestrator.vercel.app`

You can customize this in Project Settings.

## Troubleshooting

### Build Fails

**Error**: `Cannot find module 'axios'`

**Solution**: Ensure `frontend/package.json` has all dependencies:
```json
{
  "dependencies": {
    "axios": "^1.13.2",
    "react": "^19.2.3",
    "react-dom": "^19.2.3",
    "react-router-dom": "^7.11.0"
  }
}
```

### Page Shows 404

**Cause**: SPA routing not configured

**Solution**: Check `vercel.json` has the catch-all route:
```json
{
  "routes": [
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

### Demo Banner Not Showing

**Cause**: `VITE_DEMO_MODE` not set or set incorrectly

**Solution**: 
1. Go to Vercel dashboard
2. Project → Settings → Environment Variables
3. Add/Update `VITE_DEMO_MODE` = `true`
4. Redeploy

### Dark Mode Not Working

**Cause**: CSS variables not loading

**Solution**: Clear browser cache and hard reload (Ctrl+Shift+R)

## Performance Optimization

Vercel automatically optimizes:

- ✅ **CDN**: Global edge network
- ✅ **Compression**: Gzip and Brotli
- ✅ **Caching**: Static assets cached
- ✅ **Build Cache**: Faster subsequent builds

For even better performance:

1. **Enable Vercel Analytics**:
   - Go to Project → Analytics
   - Click "Enable"

2. **Enable Vercel Speed Insights**:
   ```bash
   cd frontend
   npm install @vercel/speed-insights
   ```
   
   Add to `main.tsx`:
   ```typescript
   import { SpeedInsights } from '@vercel/speed-insights/react';
   
   // In your root component
   <SpeedInsights />
   ```

## Cost

The demo runs on Vercel's **Free tier**, which includes:

- ✅ Unlimited bandwidth
- ✅ Automatic HTTPS
- ✅ Automatic deployments from Git
- ✅ 100 GB-hours of compute per month
- ✅ Serverless functions

Perfect for demos and prototypes!

## Next Steps

- 📊 Monitor your deployment in [Vercel Dashboard](https://vercel.com/dashboard)
- 🔗 Share the demo URL with your team
- 📝 Customize the mock data for your use case
- 🚀 Deploy the production version with a real backend

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Vite Documentation](https://vitejs.dev/guide/)
- [React Documentation](https://react.dev/)
- [Project Issues](https://github.com/forcebyte/flux-orchestrator/issues)

---

**Ready to deploy?** [Start here →](https://vercel.com/new)
