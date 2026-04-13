import re

def clean_file(filepath, patterns):
    with open(filepath, 'r') as f:
        text = f.read()
    
    for pattern, repl, flags in patterns:
        text = re.sub(pattern, repl, text, flags=flags)
        
    with open(filepath, 'w') as f:
        f.write(text)

# LandingNav
clean_file('client/src/components/LandingNav.tsx', [
    (r'<a[^>]*href="/pricing"[^>]*>.*?</a>', '', re.IGNORECASE | re.DOTALL),
    (r'<Link[^>]*href="/pricing"[^>]*>.*?</Link>', '', re.IGNORECASE | re.DOTALL)
])

# Footer
clean_file('client/src/components/Footer.tsx', [
    (r'© 2025 CA GPT. All rights reserved.', '© 2025 CA GPT. All rights reserved. Powered by FinACEverse.', 0),
    (r'<li>\s*<Link href="/pricing".*?</li>\n?', '', re.IGNORECASE | re.DOTALL),
    (r'<Link href="/regional-pricing".*?</Link>\n?', '', re.IGNORECASE | re.DOTALL)
])

# Settings
clean_file('client/src/pages/Settings.tsx', [
    (r'<Button[^>]*onClick=\{\(\) => setLocation\(\'/pricing\'\)\}.*?</Button>', '', re.DOTALL)
])

# Auth
clean_file('client/src/pages/Auth.tsx', [
    (r"setLocation\('/pricing'\);", "setLocation('/chat');", 0),
    (r"Redirect back to pricing page", "Redirect to chat", 0)
])

# Features
clean_file('client/src/pages/Features.tsx', [
    (r'\{\s*/\*\s*EasyLoans DSA Section\s*\*/\s*\}[\s\S]*?</div>\s*</div>\s*</div>', '', 0),
    (r'<Link href="/pricing">[\s\S]*?</Link>', '', 0)
])

# Chat
clean_file('client/src/pages/Chat.tsx', [
    (r'\{\s*id:\s*\'easy-loans\',\s*label:\s*\'EasyLoans\',.*?\},\n?', '', 0),
    (r'\{\s*id:\s*\'easy-loans\',\s*label:\s*\'EasyLoans Advisor\',.*?\},\n?', '', 0)
])

# ChatSidebar
clean_file('client/src/components/ChatSidebar.tsx', [
    (r'<DropdownMenuItem\s*onClick=\{\(\) => handleModeChange\(\'easy-loans\'\)\}[\s\S]*?</DropdownMenuItem>', '', 0)
])

print("Finished cleaning links and references.")
