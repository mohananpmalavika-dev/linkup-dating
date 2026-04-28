with open('c:/Users/Dhanya/LinkUp/src/components/Login.js', 'r') as f:
    content = f.read()

# Fix 1: Missing </div> for channel-selector block
content = content.replace(
    '              </div>\n          ) : null}',
    '              </div>\n            </div>\n          ) : null}'
)

# Fix 2: Missing closing </div> for login-container
# Count opening and closing divs in the JSX return
old_end = '''        </div>
  );
};

export default Login;'''

new_end = '''        </div>
    </div>
  );
};

export default Login;'''

content = content.replace(old_end, new_end)

with open('c:/Users/Dhanya/LinkUp/src/components/Login.js', 'w') as f:
    f.write(content)

print('Fixed Login.js')
