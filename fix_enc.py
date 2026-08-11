import io
def fix():
    with io.open('admin.html', 'r', encoding='utf-8') as f:
        c = f.read()
    c = c.replace('â‚¬', '€')
    c = c.replace('âœ“', '✓')
    c = c.replace('â”€', '─')
    c = c.replace('â• ', '═')
    c = c.replace('â†’', '→')
    with io.open('admin.html', 'w', encoding='utf-8') as f:
        f.write(c)

if __name__ == '__main__':
    fix()
