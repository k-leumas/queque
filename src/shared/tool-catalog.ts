/**
 * Shipped allow list of notable command-line tools that have common alternatives.
 *
 * Only `CATALOG ∩ installed` ever reaches a model prompt (Phase 9 D-04): the client
 * intersects this list with zsh's `$commands` handoff and sends the result in the
 * `installed-tools` envelope chunk. Every name here is a public tool name, so private
 * binaries, shell functions and aliases can never leak through this path.
 *
 * Seeded verbatim from spike 003 (`sources/003-prompt-steering/catalog.ts`, 196 names,
 * same order) so the steering evidence stays comparable. It mostly omits basic
 * POSIX/macOS utilities (ls, grep, find, sed, awk, du), but the seed keeps a few common
 * ones (cut, ssh, scp, ping, whois, traceroute, pbcopy, the reserved word `time`) and a
 * few package names that are never command words (bottom, httpie, git-delta, csvkit,
 * moreutils). Both groups are harmless: only names zsh reports as installed are sent,
 * and a package-only name is never an installed command word.
 *
 * Adding or removing names needs no daemon capability bump — the daemon-side chunk
 * schema filters names it does not know. Keep `CATALOG.length <= INSTALLED_TOOLS_MAX`.
 */
export const CATALOG: readonly string[] = Object.freeze(
  `
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
`
    .trim()
    .split(/\s+/),
);

/** O(1) membership for the allow list. */
export const CATALOG_SET: ReadonlySet<string> = new Set(CATALOG);

/** Shape of a plain tool name on the wire: no spaces, slashes, quotes or shell syntax. */
export const TOOL_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;

/** Longest tool name the `installed-tools` chunk accepts. */
export const TOOL_NAME_MAX_LENGTH = 64;

/**
 * Structural cap on the `installed-tools` list, independent of the catalog size, so
 * growing the catalog never changes the wire contract while it stays under this cap.
 */
export const INSTALLED_TOOLS_MAX = 512;

/**
 * Returns the catalog members for which `isInstalled` is true, sorted.
 * Sorting happens in Node, never in zsh (D-01: looping `$commands` in zsh is slow).
 */
export function installedCatalogTools(_isInstalled: (name: string) => boolean): string[] {
  throw new Error('installedCatalogTools: not implemented');
}
