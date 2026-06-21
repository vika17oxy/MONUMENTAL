import re
s = open("/tmp/pi.txt").read()
for tgt in ["robot_a_rail_base","robot_b_rail_base","robot_a_arm_tool0","robot_b_arm_tool0"]:
    m = re.search(r'name:\s*"' + tgt + r'".*?position\s*\{(.*?)\}', s, re.S)
    if m:
        b = m.group(1)
        def g(a):
            r = re.search(a + r':\s*([-0-9.eE]+)', b); return r.group(1) if r else "0"
        print(tgt, "->", round(float(g("x")),3), round(float(g("y")),3), round(float(g("z")),3))
    else:
        print(tgt, "NOT FOUND")
