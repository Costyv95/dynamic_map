import re
with open('/home/costi/workspace/water/homeassistant/floor2.svg', 'r') as f:
    content = f.read()
texts = re.findall(r'<text[^>]*>(.*?)</text>', content, re.DOTALL)
for t in texts:
    if re.search(r'[a-zA-Z]', t):
        print("LETTERS TEXT:", repr(t))
