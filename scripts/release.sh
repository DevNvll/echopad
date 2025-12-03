#!/bin/bash
# Echopad Release Script
# Usage: ./scripts/release.sh 0.2.0

set -e

VERSION=$1

if [ -z "$VERSION" ]; then
    echo "❌ Usage: ./scripts/release.sh <version>"
    echo "   Example: ./scripts/release.sh 0.2.0"
    exit 1
fi

# Validate version format
if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "❌ Invalid version format. Use semantic versioning (e.g., 0.2.0)"
    exit 1
fi

echo "🚀 Preparing release v$VERSION"

# Update version in package.json
echo "📦 Updating package.json..."
if command -v jq &> /dev/null; then
    jq ".version = \"$VERSION\"" package.json > tmp.json && mv tmp.json package.json
else
    sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" package.json && rm -f package.json.bak
fi

# Update version in tauri.conf.json
echo "⚙️  Updating tauri.conf.json..."
if command -v jq &> /dev/null; then
    jq ".version = \"$VERSION\"" src-tauri/tauri.conf.json > tmp.json && mv tmp.json src-tauri/tauri.conf.json
else
    sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json && rm -f src-tauri/tauri.conf.json.bak
fi

# Update version in Cargo.toml
echo "🦀 Updating Cargo.toml..."
sed -i.bak "s/^version = \"[^\"]*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml && rm -f src-tauri/Cargo.toml.bak

# Git operations
echo "📝 Creating git commit and tag..."
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "chore: bump version to v$VERSION"
git tag -a "v$VERSION" -m "Release v$VERSION"

echo ""
echo "✅ Version bumped to v$VERSION"
echo ""
echo "Next steps:"
echo "  1. Review the changes: git log -1 && git show v$VERSION"
echo "  2. Push to GitHub:     git push origin main --tags"
echo "  3. The GitHub Action will automatically build and create the release"
echo ""




