#!/bin/bash
# Deploy Flux Orchestrator Demo to Vercel

echo "🚀 Deploying Flux Orchestrator Demo to Vercel..."
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Navigate to the project root (if script is run from anywhere)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "📦 Building frontend in demo mode..."
cd frontend
npm install
npm run build:demo

cd ..

echo ""
echo "🌐 Deploying to Vercel..."
echo ""
echo "⚠️  Make sure to set the following in Vercel:"
echo "    Environment Variable: VITE_DEMO_MODE=true"
echo ""

# Deploy to Vercel
vercel --prod

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🔗 Your demo site should be live at the URL shown above"
echo "📚 For more information, see DEMO.md"
