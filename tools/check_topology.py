"""Independent reference checks for the TopoGo proposal (Python 3.10+).

Run: python check_topology.py
Writes topology_checks.json beside this file. This is a topology validator,
not a Go rules engine or a completed game implementation.
"""
from collections import Counter, defaultdict, deque

def build(n: int, kind: str) -> dict:
    if n < 3:
        raise ValueError("Use N >= 3; small degenerate grids are not specified.")
    if kind not in {"plane", "torus", "mobius", "klein", "projective"}:
        raise ValueError(f"Unknown topology: {kind}")
    flip_x = kind in {'mobius','klein','projective'}
    wrap_x = kind != 'plane'
    wrap_y = kind in {'torus','klein','projective'}
    flip_y = kind == 'projective'
    def v(x,y): return y*n+x
    def edge(a,b): return tuple(sorted((a,b)))
    E=set()
    for y in range(n):
        for x in range(n):
            if x+1<n: E.add(edge(v(x,y),v(x+1,y)))
            if y+1<n: E.add(edge(v(x,y),v(x,y+1)))
    if wrap_x:
        for y in range(n): E.add(edge(v(n-1,y),v(0,n-1-y if flip_x else y)))
    if wrap_y:
        for x in range(n): E.add(edge(v(x,n-1),v(n-1-x if flip_y else x,0)))
    F=[]
    for y in range(n-1):
        for x in range(n-1): F.append([v(x,y),v(x+1,y),v(x+1,y+1),v(x,y+1)])
    if wrap_x:
        for y in range(n-1):
            F.append([v(n-1,y), v(0,n-1-y if flip_x else y),v(0,n-2-y if flip_x else y+1),v(n-1,y+1)])
    if wrap_y:
        for x in range(n-1):
            F.append([v(x,n-1),v(n-1-x if flip_y else x,0),v(n-2-x if flip_y else x+1,0),v(x+1,n-1)])
    if kind=='torus': F.append([v(n-1,n-1),v(0,n-1),v(0,0),v(n-1,0)])
    if kind=='klein': F.append([v(n-1,n-1),v(0,0),v(0,n-1),v(n-1,0)])
    faces_by_edge=defaultdict(list)
    links=defaultdict(list)
    for i,f in enumerate(F):
        for j,a in enumerate(f):
            b=f[(j+1)%4]
            e=edge(a,b)
            assert e in E
            faces_by_edge[e].append((i,1 if a<b else -1))
            links[a].append(edge(f[j-1],b))
    assert set(faces_by_edge)==E
    assert all(len(inc) in [1,2] for inc in faces_by_edge.values())
    # Each vertex link must be one cycle (interior) or one path (boundary).
    for a, link in links.items():
        ladj=defaultdict(set)
        for b,c in link: ladj[b].add(c);ladj[c].add(b)
        seen=set();q=[next(iter(ladj))]
        while q:
            b=q.pop()
            if b in seen: continue
            seen.add(b);q.extend(ladj[b]-seen)
        assert len(seen)==len(ladj)
        degs=Counter(map(len,ladj.values()))
        assert set(degs)<= {1,2} and degs[1] in {0,2},(kind,a,degs)
    # Propagate choices of face orientations.
    adj=defaultdict(list)
    for inc in faces_by_edge.values():
        if len(inc)==2:
            (a,s),(b,t)=inc;adj[a].append((b,-s*t));adj[b].append((a,-s*t))
    assigned={};orientable=True
    for start in range(len(F)):
        if start in assigned:continue
        assigned[start]=1;q=[start]
        while q:
            a=q.pop()
            for b,s in adj[a]:
                z=assigned[a]*s
                if b in assigned:
                    if assigned[b]!=z: orientable=False
                else: assigned[b]=z;q.append(b)
    badj=defaultdict(set)
    for (a,b), inc in faces_by_edge.items():
        if len(inc)==1: badj[a].add(b);badj[b].add(a)
    seen=set();boundary=0
    for start in badj:
        if start in seen:continue
        boundary+=1;q=[start]
        while q:
            a=q.pop()
            if a in seen:continue
            seen.add(a);q.extend(badj[a]-seen)
    adjv=[set() for _ in range(n*n)]
    for a,b in E:
        assert a != b, "Self-loop"
        adjv[a].add(b);adjv[b].add(a)
    seen=set();q=[0]
    while q:
        a=q.pop()
        if a in seen:continue
        seen.add(a);q.extend(adjv[a]-seen)
    assert len(seen)==n*n, "Disconnected board"
    return dict(kind=kind,n=n,vertices=n*n,edges=len(E),faces=len(F),euler=n*n-len(E)+len(F),orientable=orientable,boundaryComponents=boundary,degreeHistogram=dict(sorted(Counter(map(len,adjv)).items())))

if __name__=='__main__':
    import json
    reports=[]
    for n in [5,9,13,19]:
        for k in ['plane','torus','mobius','klein','projective']:
            report=build(n,k)
            expected={
                'plane': (2*n*(n-1),(n-1)**2,1,True,1,
                          {2:4,3:4*(n-2),4:(n-2)**2}),
                'torus': (2*n*n,n*n,0,True,0,{4:n*n}),
                'mobius': (2*n*n-n,n*(n-1),0,False,1,
                           {3:2*n,4:n*(n-2)}),
                'klein': (2*n*n,n*n,0,False,0,{4:n*n}),
                'projective': (2*n*n-2,n*n-1,1,False,0,
                               {3:4,4:n*n-4}),
            }[k]
            actual=tuple(report[key] for key in
                         ('edges','faces','euler','orientable',
                          'boundaryComponents','degreeHistogram'))
            assert actual==expected, (n,k,actual,expected)
            reports.append(report)
    print(json.dumps([r for r in reports if r['n']==19],ensure_ascii=False,indent=2))
    from pathlib import Path
    output=Path(__file__).with_name('topology_checks.json')
    output.write_text(json.dumps(reports,indent=2)+'\n',encoding='utf-8')
    print(f'PASS: {len(reports)} topology/size combinations; wrote {output.name}')
