with open('c:/Users/Dhanya/LinkUp/src/components/Login.js', 'r') as f:
    content = f.read()

print('form:', content.count('<form'), content.count('</form>'))
print('span:', content.count('<span'), content.count('</span>'))
print('label:', content.count('<label'), content.count('</label>'))
print('button:', content.count('<button'), content.count('</button>'))
print('input:', content.count('<input'))
print('div:', content.count('<div'), content.count('</div>'))
print('OK!' if content.count('<div') == content.count('</div>') else 'MISMATCH!')
