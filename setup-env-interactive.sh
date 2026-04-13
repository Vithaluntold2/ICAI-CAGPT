#!/bin/bash

echo "🔐 Interactive Environment Setup for Accute Platform"
echo "=================================================="
echo ""

# Read current .env file
if [ -f .env ]; then
    echo "📋 Found existing .env file. We'll add missing variables."
    echo ""
else
    echo "❌ No .env file found. Please run: cp .env.supabase .env first"
    exit 1
fi

# Function to add or update env variable
add_env_var() {
    local key=$1
    local value=$2
    
    if grep -q "^$key=" .env; then
        # Update existing
        sed -i.bak "s|^$key=.*|$key=\"$value\"|" .env
        echo "✅ Updated $key"
    else
        # Add new
        echo "$key=\"$value\"" >> .env
        echo "✅ Added $key"
    fi
}

echo "🤖 AI Provider API Keys:"
echo "========================"

# OpenAI API Key
echo ""
echo "Enter your OpenAI API Key (starts with sk-...):"
echo "Get it from: https://platform.openai.com/api-keys"
read -p "OpenAI API Key: " openai_key
if [ ! -z "$openai_key" ]; then
    add_env_var "OPENAI_API_KEY" "$openai_key"
fi

# Anthropic API Key
echo ""
echo "Enter your Anthropic API Key (starts with sk-ant-...):"
echo "Get it from: https://console.anthropic.com/"
read -p "Anthropic API Key: " anthropic_key
if [ ! -z "$anthropic_key" ]; then
    add_env_var "ANTHROPIC_API_KEY" "$anthropic_key"
fi

# Azure OpenAI (optional)
echo ""
echo "Do you want to configure Azure OpenAI? (y/n)"
read -p "Configure Azure OpenAI? " use_azure
if [ "$use_azure" = "y" ] || [ "$use_azure" = "Y" ]; then
    echo "Enter your Azure OpenAI API Key:"
    read -p "Azure OpenAI API Key: " azure_key
    if [ ! -z "$azure_key" ]; then
        add_env_var "AZURE_OPENAI_API_KEY" "$azure_key"
    fi
    
    echo "Enter your Azure OpenAI Endpoint (e.g., https://your-resource.openai.azure.com/):"
    read -p "Azure OpenAI Endpoint: " azure_endpoint
    if [ ! -z "$azure_endpoint" ]; then
        add_env_var "AZURE_OPENAI_ENDPOINT" "$azure_endpoint"
    fi
fi

echo ""
echo "💳 Stripe Integration (Optional):"
echo "================================="
echo "Do you want to configure Stripe for billing? (y/n)"
read -p "Configure Stripe? " use_stripe
if [ "$use_stripe" = "y" ] || [ "$use_stripe" = "Y" ]; then
    echo "Enter your Stripe Secret Key (starts with sk_test_ or sk_live_):"
    read -p "Stripe Secret Key: " stripe_secret
    if [ ! -z "$stripe_secret" ]; then
        add_env_var "STRIPE_SECRET_KEY" "$stripe_secret"
    fi
    
    echo "Enter your Stripe Publishable Key (starts with pk_test_ or pk_live_):"
    read -p "Stripe Publishable Key: " stripe_public
    if [ ! -z "$stripe_public" ]; then
        add_env_var "STRIPE_PUBLISHABLE_KEY" "$stripe_public"
    fi
fi

echo ""
echo "🎉 Environment setup complete!"
echo ""
echo "📋 Current environment variables:"
echo "================================="
cat .env | grep -E "(OPENAI_API_KEY|ANTHROPIC_API_KEY|AZURE_|STRIPE_)" | sed 's/=.*/=***HIDDEN***/'
echo ""
echo "🚀 Ready to start the server!"
echo "Run: npm run dev"
