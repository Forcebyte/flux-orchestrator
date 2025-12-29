# GitHub Pages Setup Guide

This guide explains how to enable GitHub Pages for the Flux Orchestrator documentation.

## Prerequisites

- Repository admin access
- Documentation files in `docs/` directory
- GitHub Actions workflow configured

## Setup Steps

### 1. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages** (in the left sidebar)
3. Under **Source**, select:
   - Source: **GitHub Actions**
4. Save the changes

### 2. Verify Workflow

The documentation deployment workflow is located at:
```
.github/workflows/docs.yml
```

This workflow:
- Triggers on pushes to `main` branch (changes in `docs/`)
- Builds the Jekyll site
- Deploys to GitHub Pages

### 3. Access Your Documentation

After the first successful deployment, your documentation will be available at:

```
https://forcebyte.github.io/flux-orchestrator
```

Replace `forcebyte` with your GitHub username/organization if you forked the repo.

## Configuration

### Update Base URL

If you forked the repository, update the `baseurl` in `docs/_config.yml`:

```yaml
baseurl: "/your-repo-name"
url: "https://your-username.github.io"
```

### Custom Domain (Optional)

To use a custom domain:

1. Add a `CNAME` file in `docs/` with your domain:
   ```
   docs.example.com
   ```

2. Configure DNS:
   - Add a CNAME record pointing to `username.github.io`
   - Or add A records pointing to GitHub Pages IPs

3. Enable HTTPS in repository settings

## Local Development

To test the documentation locally before pushing:

```bash
cd docs

# Install dependencies (first time only)
bundle install

# Serve locally
bundle exec jekyll serve

# Open http://localhost:4000/flux-orchestrator
```

## Troubleshooting

### Build Failures

Check the Actions tab in your repository to see build logs:
```
https://github.com/your-username/flux-orchestrator/actions
```

Common issues:
- **Invalid YAML front matter**: Ensure all `.md` files have proper front matter
- **Missing theme**: The workflow installs the theme automatically
- **Permission errors**: Ensure Pages is enabled and workflow has correct permissions

### 404 Errors

If pages return 404:
1. Verify GitHub Pages is enabled in Settings
2. Check that the workflow has deployed successfully
3. Ensure `baseurl` in `_config.yml` matches your repository name
4. Clear browser cache

### Links Not Working

- Use relative links without the baseurl
- Jekyll will automatically add the baseurl
- Example: `[Link](quickstart)` not `[Link](/flux-orchestrator/quickstart)`

## Updating Documentation

1. Edit files in the `docs/` directory
2. Commit and push to `main` branch
3. GitHub Actions will automatically rebuild and deploy
4. Changes appear in 1-2 minutes

## Manual Trigger

You can manually trigger a documentation deployment:

1. Go to Actions tab
2. Select "Deploy Documentation to GitHub Pages"
3. Click "Run workflow"
4. Select branch and click "Run workflow"

## Monitoring

- **Build Status**: Check the Actions tab for workflow status
- **Deployment Status**: Settings → Pages shows the last deployment
- **Analytics**: Enable GitHub Pages analytics in Settings

## Further Customization

### Theme Options

Edit `docs/_config.yml` to customize:
- Color scheme (dark/light)
- Logo
- Search settings
- Navigation structure

### Adding New Pages

1. Create a new `.md` file in `docs/`
2. Add front matter:
   ```yaml
   ---
   layout: default
   title: New Page
   nav_order: 14
   ---
   ```
3. Commit and push

### Custom CSS

Create `docs/assets/css/custom.css` and reference in `_config.yml`

## Resources

- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [Jekyll Documentation](https://jekyllrb.com/)
- [Just the Docs Theme](https://just-the-docs.github.io/just-the-docs/)
