#!/usr/bin/env zsh
# Spike 001b — what does "rehash then hand off" cost on every ?? (widget-side work).
# Run: zsh rehash-cost.zsh   (non-interactive: $PATH from env, no prompt noise)
zmodload zsh/datetime zsh/parameter
out=${TMPDIR:-/tmp}/qq-spike-001; mkdir -p $out
ms() { printf '%7.3f' $(( ($2 - $1) * 1000 )) }

print "PATH dirs: ${#path}"
print "\n-- warm table: write names only --"
print -rl -- ${(k)commands} >/dev/null   # ensure filled
for i in {1..5}; do
  t0=$EPOCHREALTIME; print -rl -- ${(k)commands} > $out/commands.txt; t1=$EPOCHREALTIME
  print "warm write: $(ms $t0 $t1) ms  (${#commands} entries)"
done

print "\n-- rehash + refill + write (what an always-fresh widget pays) --"
for i in {1..5}; do
  t0=$EPOCHREALTIME; rehash; t1=$EPOCHREALTIME
  n=${#commands}; t2=$EPOCHREALTIME
  print -rl -- ${(k)commands} > $out/commands.txt; t3=$EPOCHREALTIME
  print "rehash $(ms $t0 $t1) | refill(${n}) $(ms $t1 $t2) | write $(ms $t2 $t3) | total $(ms $t0 $t3) ms"
done

print "\n-- cheap staleness signals --"
t0=$EPOCHREALTIME; n=${#commands}; t1=$EPOCHREALTIME
print "\${#commands} on warm table: $(ms $t0 $t1) ms"
zmodload -F zsh/stat b:zstat
t0=$EPOCHREALTIME
local -a mt; for d in $path; do [[ -d $d ]] && { zstat -A s +mtime -- $d; mt+=$s }; done
t1=$EPOCHREALTIME
print "zstat mtime of ${#path} PATH dirs: $(ms $t0 $t1) ms  -> fingerprint ${(j:,:)mt[1,3]}..."

print "\n-- does a dir mtime change on install? --"
bin=$out/bin2; mkdir -p $bin
zstat -A before +mtime -- $bin
sleep 1.1
print '#!/bin/sh' > $bin/qqnew; chmod +x $bin/qqnew
zstat -A after +mtime -- $bin
print "mtime before=$before after=$after changed=$(( after != before ))"
ln -sf /bin/ls $bin/qqlink 2>/dev/null; zstat -A after2 +mtime -- $bin
print "symlink add (brew-style) changed again: $(( after2 != after ))"
rm -rf $bin
