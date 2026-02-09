#!/bin/bash

# Setup GitHub Secrets for Docker Hub
# This script helps you configure GitHub Actions to push Docker images

set -e

echo "=========================================="
echo "GitHub Actions Docker Hub Setup"
echo "=========================================="
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ Error: GitHub CLI (gh) is not installed"
    echo ""
    echo "Install it with:"
    echo "  macOS: brew install gh"
    echo "  Linux: See https://github.com/cli/cli#installation"
    exit 1
fi

# Check if logged in to GitHub
if ! gh auth status &> /dev/null; then
    echo "❌ Error: Not logged in to GitHub"
    echo ""
    echo "Login with: gh auth login"
    exit 1
fi

echo "✅ GitHub CLI is installed and authenticated"
echo ""

# Get current repository
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")

if [ -z "$REPO" ]; then
    echo "❌ Error: Not in a GitHub repository"
    echo "Please run this script from the repository directory"
    exit 1
fi

echo "📦 Repository: $REPO"
echo ""

# Check existing secrets
echo "🔍 Checking existing secrets..."
EXISTING_SECRETS=$(gh secret list 2>/dev/null || echo "")

if echo "$EXISTING_SECRETS" | grep -q "DOCKER_USERNAME"; then
    echo "⚠️  DOCKER_USERNAME already exists"
    read -p "Do you want to overwrite it? (y/N): " OVERWRITE_USERNAME
    if [[ ! $OVERWRITE_USERNAME =~ ^[Yy]$ ]]; then
        echo "Skipping DOCKER_USERNAME"
        SKIP_USERNAME=true
    fi
fi

if echo "$EXISTING_SECRETS" | grep -q "DOCKER_PASSWORD"; then
    echo "⚠️  DOCKER_PASSWORD already exists"
    read -p "Do you want to overwrite it? (y/N): " OVERWRITE_PASSWORD
    if [[ ! $OVERWRITE_PASSWORD =~ ^[Yy]$ ]]; then
        echo "Skipping DOCKER_PASSWORD"
        SKIP_PASSWORD=true
    fi
fi

echo ""
echo "=========================================="
echo "Docker Hub Credentials Setup"
echo "=========================================="
echo ""

# Get Docker Hub username
if [ "$SKIP_USERNAME" != "true" ]; then
    echo "Enter your Docker Hub username:"
    echo "(Default: rahulnutakki)"
    read -p "Username: " DOCKER_USERNAME
    DOCKER_USERNAME=${DOCKER_USERNAME:-rahulnutakki}

    echo ""
    echo "Setting DOCKER_USERNAME secret..."
    if gh secret set DOCKER_USERNAME -b "$DOCKER_USERNAME"; then
        echo "✅ DOCKER_USERNAME set successfully"
    else
        echo "❌ Failed to set DOCKER_USERNAME"
        exit 1
    fi
fi

echo ""

# Get Docker Hub password/token
if [ "$SKIP_PASSWORD" != "true" ]; then
    echo "=========================================="
    echo "Docker Hub Access Token"
    echo "=========================================="
    echo ""
    echo "⚠️  IMPORTANT: Use an Access Token, not your password!"
    echo ""
    echo "How to create a Docker Hub Access Token:"
    echo "1. Go to: https://hub.docker.com/settings/security"
    echo "2. Click 'New Access Token'"
    echo "3. Name: github-actions-devops-portal"
    echo "4. Permissions: Read, Write, Delete"
    echo "5. Click 'Generate'"
    echo "6. Copy the token (it won't be shown again)"
    echo ""
    read -p "Press Enter when you have your access token ready..."
    echo ""

    # Get token securely (hidden input)
    echo "Paste your Docker Hub Access Token:"
    read -s DOCKER_PASSWORD
    echo ""

    if [ -z "$DOCKER_PASSWORD" ]; then
        echo "❌ Error: Password/token cannot be empty"
        exit 1
    fi

    echo "Setting DOCKER_PASSWORD secret..."
    if echo "$DOCKER_PASSWORD" | gh secret set DOCKER_PASSWORD; then
        echo "✅ DOCKER_PASSWORD set successfully"
    else
        echo "❌ Failed to set DOCKER_PASSWORD"
        exit 1
    fi
fi

echo ""
echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""

# List all secrets
echo "Current GitHub Secrets:"
gh secret list

echo ""
echo "=========================================="
echo "Next Steps"
echo "=========================================="
echo ""
echo "1. Make a code change and commit:"
echo "   git add ."
echo "   git commit -m 'Test GitHub Actions'"
echo "   git push origin main"
echo ""
echo "2. Watch the build in GitHub Actions:"
echo "   https://github.com/$REPO/actions"
echo ""
echo "3. Check Docker Hub for the new image:"
echo "   https://hub.docker.com/r/$DOCKER_USERNAME/devprotal/tags"
echo ""
echo "4. Pull the image:"
echo "   docker pull $DOCKER_USERNAME/devprotal:latest"
echo ""

exit 0
