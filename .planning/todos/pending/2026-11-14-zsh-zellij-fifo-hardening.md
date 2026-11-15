---
title: Port bash Zellij FIFO hardening to the zsh widget
created: 2026-11-14
area: shell
---

11-07 gave bash's Zellij path three protections zsh lacks: check the `mkfifo` status, open the FIFO
read end read-write before `zellij run`, and have a failed launcher write a sentinel so the read
wakes at once. Without them a zsh pane that never starts hangs the widget until the read times out
(or forever if the read has no timeout). See 11-07-SUMMARY.md and shell/bash/queque.bash.
