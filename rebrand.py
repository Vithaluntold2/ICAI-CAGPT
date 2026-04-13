#!/usr/bin/env python3
"""Rebrand Luca -> CA GPT in AI service files"""

replacements = [
    ('You are Luca, a pan-global accounting superintelligence and expert CPA/CA advisor',
     'You are CA GPT, an ICAI-aligned accounting superintelligence and expert CA advisor'),
    ('You are Luca, a senior tax professional',
     'You are CA GPT, a senior tax professional'),
    ('You are Luca, a senior audit professional',
     'You are CA GPT, a senior audit professional'),
    ('You are Luca, a senior financial reporting expert',
     'You are CA GPT, a senior financial reporting expert'),
    ('You are Luca, a regulatory compliance expert',
     'You are CA GPT, a regulatory compliance expert'),
    ('You are Luca, a senior financial advisory professional',
     'You are CA GPT, a senior financial advisory professional'),
    ('You are Luca, an expert research assistant',
     'You are CA GPT, an expert research assistant'),
    ('You are Luca, an expert CPA/CA advisor',
     'You are CA GPT, an expert CA advisor'),
    ("LucaSearch", "CA GPT Search"),
    ("LUCA'S KNOWLEDGE BASE", "CA GPT KNOWLEDGE BASE"),
    ("Luca ALWAYS asks clarifying", "CA GPT ALWAYS asks clarifying"),
    ("You are Luca's Loan Advisor", "You are CA GPT Loan Advisor"),
    ("**Luca**: Hi!", "**CA GPT**: Hi!"),
    ("**Luca**: Great choice", "**CA GPT**: Great choice"),
    ("**Luca**: Perfect", "**CA GPT**: Perfect"),
]

files = [
    'server/services/searchEngine.ts',
    'server/services/aiOrchestrator.ts',
    'server/services/core/continuousLearning.ts',
    'server/services/promptBuilder.ts',
]

for f in files:
    with open(f, 'r') as fh:
        content = fh.read()
    for old, new in replacements:
        content = content.replace(old, new)
    with open(f, 'w') as fh:
        fh.write(content)
    print(f'Updated: {f}')

print('All done.')
