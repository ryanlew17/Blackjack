"""Reproduce the REQ-2026-021 historical 51-card supply model.

Run from the repository root:
    python3 scripts/validation/contest_supply_model.py

The card table is resolved relative to this file. Output is JSON on stdout.
Only the Python standard library is needed. Reference results use Python 3.15;
sampling details may vary across versions, while the exact probabilities and
predeclared acceptance bounds remain unchanged.

This experiment models the historical finite 51-card stock and opening-hand
effects. It does not validate the later 54-card generation model, active skills,
game AI, or match win-rate balance. Historical conclusions belong in REQ-021.
"""

# @req REQ-2026-021: isolated supply/settlement experiment, no game AI.
import itertools, json, math, platform, random, statistics
from collections import Counter
from pathlib import Path
CARD_TABLE = Path(__file__).resolve().parents[2] / "docs/design/contest-trumps.md"
CARDS = []
for line in CARD_TABLE.read_text(encoding="utf-8").splitlines():
    cells = [x.strip() for x in line.strip().strip("|").split("|")]
    if len(cells) == 7 and cells[0].startswith(chr(96)):
        CARDS.append((cells[0].strip(chr(96)), list(map(int, cells[3].split("/")))))
assert len(CARDS) == 51 and len({x[0] for x in CARDS}) == 51
SEED, SAMPLES = 20261021, 100000
P = [0.20, 0.30, 0.40, 0.50, 0.60]
# Predeclared acceptance: per-type MC vs exact <= 6 binomial SE + 1/n;
# instance first-draw frequency within 6 SE + 1/n; no quota violation;
# unsaturated gate rate within 6 SE, strictly increasing mean grants.
out = {"seed":SEED, "samples":SAMPLES, "python":platform.python_version(),
       "uniform":[], "flow":[], "encounters":{}, "stress":[]}
for d, p in enumerate(P):
    pool = [k for k, (_, cs) in enumerate(CARDS) for _ in range(cs[d])]
    M, n = len(pool), 10
    rng = random.Random(SEED + 1000*d)
    seen, first = Counter(), Counter()
    for _ in range(SAMPLES):
        selection = rng.sample(range(M), n)
        first[selection[0]] += 1
        for k in set(pool[j] for j in selection): seen[k] += 1
    worst = 0.0
    for k, (name, cs) in enumerate(CARDS):
        c = cs[d]
        exact = 0.0 if c == 0 else 1-math.comb(M-c,n)/math.comb(M,n)
        empirical = seen[k]/SAMPLES
        se = math.sqrt(exact*(1-exact)/SAMPLES)
        assert abs(empirical-exact) <= 6*se + 1/SAMPLES
        worst = max(worst, abs(empirical-exact))
        out["encounters"].setdefault(name, []).append({
            "copy":c, "first":c/M, "any10":exact, "mc10":empirical})
    for j in range(M):
        se = math.sqrt((1/M)*(1-1/M)/SAMPLES)
        assert abs(first[j]/SAMPLES-1/M) <= 6*se + 1/SAMPLES
    out["uniform"].append({"M":M, "max_type_error_pp":100*worst})
    # Same uniforms across levels to isolate gate monotonicity.
    gate = random.Random(SEED+7)
    extra = [sum(gate.random()<p for _ in range(12)) for _ in range(SAMPLES)]
    avg = statistics.mean(extra)
    se = math.sqrt(12*p*(1-p)/SAMPLES)
    assert abs(avg-12*p) <= 6*se
    out["flow"].append({"p":p, "extra12":avg,
        "ci95":[avg-1.96*se,avg+1.96*se], "round6_total":8+avg})
    # Delivery stress is a channel probe, NOT a card-playing or win-rate policy.
    for rounds in [6,12]:
        for spend in [0,1,3]:
            r = random.Random(SEED + d*10000 + rounds*10 + spend)
            grants=[]; blocked=0; emptied=0
            for _ in range(10000):
                bag=pool.copy(); drawn=Counter()
                state=[0,0]  # hand, skipped-full
                def take():
                    if state[0]>=8: state[1]+=1; return
                    if not bag: return
                    k=r.randrange(len(bag))
                    typ=bag.pop(k); drawn[typ]+=1; state[0]+=1
                take(); take()
                for turn in range(rounds):
                    take()
                    for _ in range(2):
                        if r.random()<p: take()
                    state[0]=max(0,state[0]-spend)
                for k,num in drawn.items(): assert num<=CARDS[k][1][d]
                sweep_index=next(k for k,x in enumerate(CARDS) if x[0]=="destroy-all")
                assert drawn[sweep_index]<=1
                grants.append(sum(drawn.values())); blocked+=state[1]
                emptied += not bag
            out["stress"].append({"d":d,"rounds":rounds,"spend":spend,
                "mean":statistics.mean(grants), "p95":sorted(grants)[9499],
                "blocked_per_game":blocked/10000,"empty_rate":emptied/10000})
assert all(out["flow"][d]["extra12"]<out["flow"][d+1]["extra12"] for d in range(4))

# Forced depletion and all-channel cap boundary in the reference bag.
out["exhaustion"]=[]
for d in range(5):
    remaining=[k for k,(_,cs) in enumerate(CARDS) for _ in range(cs[d])]
    taken=Counter(remaining)
    M=len(remaining)
    remaining.clear()
    assert sum(taken.values())==M
    assert all(taken[k]<=cs[d] for k,(_,cs) in enumerate(CARDS))
    sweep=next(k for k,(name,_) in enumerate(CARDS) if name=="destroy-all")
    assert taken[sweep]<=1
    # Follow Suit searches remaining real instances; a spent one-copy card
    # cannot be created again, including when it is not yet played.
    assert not any(k==sweep for k in remaining)
    out["exhaustion"].append(M)

def winner(a,b,target=21):
    return 0 if a==b else (-1 if ((a<=target and b<=target and a>b) or
        (a<=target<b) or (a>target and b>target and a<b)) else 1)
flips=Counter(); wins=Counter(); total=0
for ah,af,bh,bf in itertools.permutations(range(1,12),4):
    a,b=ah+af,bh+bf; base=winner(a,b); total+=1
    scenarios={"base":(a,b), "double_enemy":(a,b+bh),
               "symbiosis":(a+bh,b+ah),
               "double_then_symbiosis":(a+2*bh,b+bh+ah)}
    for name,(x,y) in scenarios.items():
        w=winner(x,y); flips[name]+=w!=base; wins[name]+=w==-1
out["opening_math"]={"states":total,"flip_rate":{k:v/total for k,v in flips.items()},
    "actor_win_rate":{k:v/total for k,v in wins.items()}}
print(json.dumps(out,ensure_ascii=False,indent=2))
