// Curated catalog of notable CLI tools that have common alternatives. Variant B sends only
// (catalog ∩ installed). This makes the list query-independent, so it's stable and cacheable.
// It deliberately omits basic POSIX/macOS utilities (ls, grep, find, sed, awk, du…),
// which every machine has.
export const CATALOG = `
rg ag ack ugrep fd fdfind fzf sk bat batcat eza exa lsd tree broot nnn ranger lf yazi
jq yq fx gron jless dasel mlr miller xsv qsv csvlook csvkit visidata vd sqlite3 duckdb
dust gdu ncdu duf dua diskus
htop btop btm bottom glances procs gtop atop iftop nethogs bandwhich
http https xh curlie httpie wget aria2c
delta difft diff-so-fancy colordiff meld
gh glab lazygit tig git-delta gitui hub
docker podman nerdctl colima orbctl lazydocker dive kubectl k9s kubectx kubens helm stern minikube kind
ffmpeg ffprobe magick convert identify mogrify sips vips gm exiftool imageoptim pngquant optipng jpegoptim cwebp
yt-dlp youtube-dl pandoc
entr watchexec fswatch nodemon watchman reflex
hyperfine time gtime
tldr tealdeer cheat navi
zoxide z autojump direnv mise asdf nvm fnm volta pyenv rbenv uv pipx poetry
node bun deno pnpm yarn npm npx python3 python pip3 ruby go cargo rustc
tmux zellij screen
mosh ssh rsync rclone scp sshpass
nmap mtr dig drill dog doggo nslookup whois traceroute
gping prettyping ping
pv parallel gparallel moreutils sponge ts
choose sd hck cut
tokei scc cloc
glow mdcat
ripgrep-all rga
lnav goaccess
age gpg openssl pass
trash rmtrash
pbcopy pbpaste xclip xsel wl-copy
`.trim().split(/\s+/);
