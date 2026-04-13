import re

with open('client/src/App.tsx', 'r') as f:
    text = f.read()

text = text.replace("import Pricing from './pages/Pricing';\n", "")
text = text.replace("import RegionalPricing from './pages/RegionalPricing';\n", "")
text = text.replace("import EasyLoans from './pages/superadmin/EasyLoans';\n", "")
text = text.replace("import EasyLoansLenders from './pages/superadmin/EasyLoansLenders';\n", "")

text = re.sub(r'<Route path="/superadmin/easyloans">[\s\S]*?</Route>', '', text)
text = re.sub(r'<Route path="/superadmin/easyloans/lenders">[\s\S]*?</Route>', '', text)
text = re.sub(r'<Route path="/pricing">[\s\S]*?</Route>', '', text)
text = re.sub(r'<Route path="/regional-pricing">[\s\S]*?</Route>', '', text)
text = re.sub(r'\{/\*\s*EasyLoans is now a chat mode[\s\S]*?<Route path="/loans">[\s\S]*?</Route>', '', text)

with open('client/src/App.tsx', 'w') as f:
    f.write(text)
print("Updated App.tsx")
