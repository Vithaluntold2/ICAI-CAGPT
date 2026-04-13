import re

def clean_file(filepath, patterns):
    with open(filepath, 'r') as f:
        text = f.read()
    
    for pattern, repl, flags in patterns:
        text = re.sub(pattern, repl, text, flags=flags)
        
    with open(filepath, 'w') as f:
        f.write(text)

clean_file('client/src/pages/Landing.tsx', [
    (r'import EasyLoansShowcase from "@/components/EasyLoansShowcase";\s*\n', '', 0),
    (r'\s*<EasyLoansShowcase\s*/>', '', 0)
])

clean_file('client/src/components/WealthWiseAcademyLanding.tsx', [
    (r'<Link href="/pricing">\s*<Button variant="outline".*?</Button>\s*</Link>', '', re.IGNORECASE | re.DOTALL),
    (r'\{\s*/\*\s*Pricing Section\s*\*/\s*\}.*?(?=\{/\*\s*CTA Section\s*\*/\})', '', re.IGNORECASE | re.DOTALL)
])

print("Finished second cleanup script.")
