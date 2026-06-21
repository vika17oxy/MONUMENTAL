import re, sys
s = open("/tmp/dp.txt").read()
found = False
for m in re.finditer(r'name:\s*"(brick_pick_[rcl])".*?position\s*\{(.*?)\}', s, re.S):
    name, body = m.group(1), m.group(2)
    def g(ax):
        r = re.search(ax + r':\s*([-0-9.eE]+)', body)
        return r.group(1) if r else '?'
    print(name, "x=" + g('x'), "y=" + g('y'), "z=" + g('z'))
    found = True
if not found:
    names = re.findall(r'name:\s*"([^"]+)"', s)
    print("no brick_pick found; size=%d; names=%s" % (len(s), names[:20]))
