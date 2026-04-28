with open('src/components/AchievementsPage.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = '''          </button>
        </div>

      {/* Achievement notification toast */}'''

new = '''          </button>
        </div>

      {/* Achievement notification toast */}'''

if old in content:
    content = content.replace(old, new, 1)
    print('Fixed missing closing div')
else:
    print('Pattern not found')

with open('src/components/AchievementsPage.js', 'w', encoding='utf-8') as f:
    f.write(content)
