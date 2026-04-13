import re

with open('client/src/index.css', 'r') as f:
    content = f.read()

# Light Mode Replacements
content = content.replace('--sidebar-primary: 279 57% 53%;   /* Luca Purple Heart #9A41CB */', '--sidebar-primary: 202 100% 26%;   /* CA Navy Blue */')
content = content.replace('--sidebar-accent: 350 100% 87%;   /* Luca Blush Pink tint */', '--sidebar-accent: 214 32% 91%;   /* CA Accent Blue tint */')
content = content.replace('--sidebar-accent-foreground: 279 57% 30%; /* Dark purple */', '--sidebar-accent-foreground: 202 100% 15%; /* Deep CA Navy */')
content = content.replace('--sidebar-ring: 279 57% 53%;      /* Luca Purple */', '--sidebar-ring: 202 100% 26%;      /* CA Navy */')

content = content.replace('/* LUCA BRAND COLORS - Light Mode */', '/* CA BRAND COLORS - Light Mode */')
content = content.replace('--primary: 279 57% 53%;           /* Luca Purple Heart #9A41CB */', '--primary: 202 100% 26%;           /* CA Navy Blue */')
content = content.replace('--secondary: 279 40% 43%;         /* Darker purple for depth */', '--secondary: 202 100% 15%;         /* Deep CA Navy for depth */')
content = content.replace('/* ACCENT - Luca Blush Pink #FFBBC1 */', '/* ACCENT - Soft Professional Blue */')
content = content.replace('--accent: 350 100% 87%;           /* Blush Pink */', '--accent: 214 32% 91%;           /* Slate 100 Accent */')
content = content.replace('--accent-foreground: 279 57% 30%; /* Dark purple text on pink */', '--accent-foreground: 202 100% 15%; /* Dark navy text */')

content = content.replace('--ring: 271 91% 65%;              /* Purple focus ring */', '--ring: 202 100% 40%;              /* CA Navy focus ring */')
content = content.replace('/* Charts - Luca Purple gradient palette */', '/* Charts - CA Brand gradient palette */')
content = content.replace('--chart-1: 279 57% 53%;           /* Luca Purple Heart */', '--chart-1: 202 100% 26%;           /* CA Navy */')
content = content.replace('--chart-2: 350 100% 87%;          /* Blush Pink */', '--chart-2: 214 32% 91%;          /* Slate Base */')
content = content.replace('--chart-3: 279 40% 43%;           /* Dark Purple */', '--chart-3: 202 100% 15%;           /* Deep Navy */')

# Dark Mode Replacements
content = content.replace('/* LUCA BRAND COLOR SYSTEM - DARK MODE */', '/* CA BRAND COLOR SYSTEM - DARK MODE */')
content = content.replace('/* Premium Dark Backgrounds - Near-black per brand guidelines */', '/* Premium Dark Backgrounds - CA Professional */')
content = content.replace('--background: 200 20% 9%;         /* Luca Near-Black #10181B */', '--background: 222 47% 11%;         /* Standard Dark Slate Background */')

content = content.replace('/* Sidebar - Luca Purple accents */', '/* Sidebar - CA Navy accents */')
content = content.replace('--sidebar-primary: 279 57% 53%;   /* Luca Purple Heart #9A41CB */', '--sidebar-primary: 202 100% 26%;   /* CA Navy Blue */')
content = content.replace('--sidebar-accent-foreground: 350 80% 90%; /* Blush pink text */', '--sidebar-accent-foreground: 214 32% 91%; /* Light slate text */')
content = content.replace('--sidebar-ring: 279 57% 53%;      /* Luca Purple */', '--sidebar-ring: 202 100% 26%;      /* CA Navy */')

content = content.replace('/* LUCA BRAND COLORS - Dark Mode */', '/* CA BRAND COLORS - Dark Mode */')
content = content.replace('--primary: 279 57% 53%;           /* Luca Purple Heart #9A41CB */', '--primary: 202 100% 26%;           /* CA Navy Blue */')
content = content.replace('--secondary: 279 45% 40%;         /* Darker purple variant */', '--secondary: 202 100% 30%;         /* Mid Navy */')
content = content.replace('/* ACCENT - Luca Blush Pink for CTAs */', '/* ACCENT - Professional Tone for CTAs */')
content = content.replace('--accent: 350 100% 87%;           /* Blush Pink #FFBBC1 */', '--accent: 214 32% 91%;           /* Slate Accent */')
content = content.replace('--accent-foreground: 279 57% 25%; /* Dark purple text */', '--accent-foreground: 214 100% 95%; /* Light text */')

content = content.replace('--ring: 271 91% 65%;              /* Purple focus ring */', '--ring: 202 100% 40%;              /* CA Navy focus ring */')

content = content.replace('/* Charts - Luca Purple gradient palette */', '/* Charts - CA Brand gradient palette */')
content = content.replace('--chart-1: 279 57% 53%;           /* Luca Purple Heart */', '--chart-1: 202 100% 26%;           /* CA Navy */')
content = content.replace('--chart-2: 350 100% 87%;          /* Blush Pink */', '--chart-2: 214 32% 91%;          /* Slate Base */')
content = content.replace('--chart-3: 279 45% 40%;           /* Dark Purple */', '--chart-3: 202 100% 30%;           /* Mid Navy */')

# Other LUCA references
content = re.sub(r'LUCA BRAND COLOR SYSTEM', 'CA BRAND COLOR SYSTEM', content, flags=re.IGNORECASE)

with open('client/src/index.css', 'w') as f:
    f.write(content)

print("Replacement complete")
