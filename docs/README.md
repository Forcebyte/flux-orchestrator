# Flux Orchestrator Documentation

This directory contains the documentation for Flux Orchestrator, which is automatically deployed to GitHub Pages.

## 📖 View Documentation

**Live Site:** https://forcebyte.github.io/flux-orchestrator

## 🏗️ Structure

- `index.md` - Home page
- `_config.yml` - Jekyll configuration
- `quickstart.md` - Quick start guide
- `architecture.md` - Architecture overview
- `development.md` - Development setup
- `features.md` - Features landing page
  - `rbac.md` - Role-based access control
  - `oauth.md` - OAuth authentication
  - `azure-aks.md` - Azure AKS integration
  - `diff-viewer-and-logs.md` - Diff viewer and log aggregation
  - `mobile.md` - Mobile responsive design
- `operations.md` - Operations landing page
  - `database.md` - Database configuration
  - `encryption.md` - Encryption setup
- `CONTRIBUTING.md` - Contributing guide

## 🛠️ Local Development

To preview the documentation locally:

```bash
# Install Jekyll
gem install bundler jekyll

# Navigate to docs directory
cd docs

# Serve locally
jekyll serve

# Open http://localhost:4000/flux-orchestrator
```

## 🚀 Deployment

Documentation is automatically deployed to GitHub Pages when changes are pushed to the `main` branch in the `docs/` directory.

The deployment workflow is defined in `.github/workflows/docs.yml`.

## 📝 Writing Documentation

### Front Matter

Each documentation page should include Jekyll front matter:

```yaml
---
layout: default
title: Page Title
nav_order: 1
parent: Parent Page (optional)
has_children: true/false (optional)
description: "Page description for SEO"
---
```

### Navigation

- Use `nav_order` to control the order in the sidebar
- Use `parent` to nest pages under a parent page
- Use `has_children: true` for parent pages

### Styling

The site uses the [Just the Docs](https://just-the-docs.github.io/just-the-docs/) theme with:

- Dark color scheme by default
- Search functionality
- Table of contents for each page
- Responsive design

### Content Guidelines

- Use clear, concise language
- Include code examples where appropriate
- Add screenshots for UI features
- Link to related documentation
- Keep pages focused on a single topic

## 🎨 Theme Customization

The site uses the Just the Docs theme with custom configuration in `_config.yml`:

- Custom logo
- Dark color scheme
- Search enabled
- Callouts for warnings, notes, and tips

## 📚 Resources

- [Jekyll Documentation](https://jekyllrb.com/docs/)
- [Just the Docs Theme](https://just-the-docs.github.io/just-the-docs/)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
