#!/usr/bin/env zsh
# Spike 001 — cost and freshness of handing zsh's $commands table to the qq client.
# Run interactively-sourced config so $commands matches a real shell:  zsh -i bench.zsh
zmodload zsh/datetime
zmodload zsh/parameter

out_dir=${TMPDIR:-/tmp}/qq-spike-001
mkdir -p "$out_dir"

ms() { printf '%.3f' $(( ($2 - $1) * 1000 )) }

print "== size =="
print "entries: ${#commands}"
print "aliases: ${#aliases}  functions: ${#functions}  builtins: ${#builtins}"

print "\n== serialize cost (names only, newline-separated) =="
for i in 1 2 3 4 5; do
  t0=$EPOCHREALTIME
  print -rl -- ${(k)commands} > "$out_dir/commands.txt"
  t1=$EPOCHREALTIME
  print "run $i: $(ms $t0 $t1) ms"
done
print "bytes: $(wc -c < $out_dir/commands.txt | tr -d ' ')"

print "\n== serialize names+paths (name\\tpath) =="
t0=$EPOCHREALTIME
for k v in ${(kv)commands}; do print -r -- "$k"$'\t'"$v"; done > "$out_dir/commands-paths.txt"
t1=$EPOCHREALTIME
print "loop: $(ms $t0 $t1) ms, bytes: $(wc -c < $out_dir/commands-paths.txt | tr -d ' ')"

print "\n== change detection: fingerprint instead of rewriting every ?? =="
t0=$EPOCHREALTIME
fp="${#commands}:${(j::)${(@k)commands}[1,0]}"   # count only (cheap)
t1=$EPOCHREALTIME
print "count fingerprint: $(ms $t0 $t1) ms"
t0=$EPOCHREALTIME
sorted=(${(ko)commands})
fp2=${#sorted}:${sorted[1]}:${sorted[-1]}
t1=$EPOCHREALTIME
print "sorted keys fingerprint: $(ms $t0 $t1) ms"

print "\n== freshness: new binary dropped into a PATH dir =="
bindir=$out_dir/bin
mkdir -p "$bindir"
path=("$bindir" $path)
rehash
name=qqspike_$RANDOM
print "before create: \$commands[$name]=${commands[$name]:-<unset>}"
print '#!/bin/sh\necho hi' > "$bindir/$name"; chmod +x "$bindir/$name"
print "after create, no rehash: \$commands[$name]=${commands[$name]:-<unset>}  (in keys: ${${(k)commands}[(Ie)$name]})"
print "  whence -p: $(whence -p $name 2>/dev/null || print '<none>')"
print "  keys now: ${#commands}"
rehash
print "after rehash: in keys: ${${(k)commands}[(Ie)$name]}  entries: ${#commands}"
t0=$EPOCHREALTIME; rehash; t1=$EPOCHREALTIME
print "rehash cost: $(ms $t0 $t1) ms"

print "\n== freshness: binary removed =="
rm -f "$bindir/$name"
print "after rm, no rehash: in keys: ${${(k)commands}[(Ie)$name]}"
rehash
print "after rehash: in keys: ${${(k)commands}[(Ie)$name]}"

print "\n== options =="
setopt | grep -i -E 'hash|rehash' || print '(no hash-related options set beyond defaults)'
zstyle -L ':completion:*' rehash
