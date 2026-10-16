# Facilitator: host this repo without leaking solutions

The starter that hackers fork lives on **GitHub `main`**. The answer key lives
only on **this laptop** as the local branch `solutions`. Do not push it.

## Publish the starter (private GitHub)

On this machine, from `main`:

```bash
gh auth login
./scripts/protect-solutions.sh     # local hook: refuse `git push … solutions`
./scripts/publish-github.sh        # creates <you>/zk-pay-starter (private), pushes main only
```

`publish-github.sh` sets `remote.github.push` to `main:main`, so even
`git push github --all` will not upload `solutions`.

If you already created the repo by hand:

```bash
git checkout main
git remote add github git@github.com:<you>/zk-pay-starter.git
git config --local remote.github.push refs/heads/main:refs/heads/main
git push -u github main
```

## Keep `solutions` on this laptop

```bash
git checkout solutions            # already exists here
./scripts/protect-solutions.sh
# never:
#   git push github solutions
#   git push --all github
```

Clone the GitHub repo on another machine? That checkout will **not** have
`solutions`. Copy the branch as a bundle if you need it on a second facilitator
laptop:

```bash
git checkout solutions
git bundle create /tmp/zk-pay-solutions.bundle solutions
# copy the file privately, then:
#   git bundle unbundle /tmp/zk-pay-solutions.bundle
```

Do not put that bundle in the public or private GitHub repo.

## Make the private repo forkable

Hackers cannot see or fork a private repo until they are collaborators.

```bash
# add each hacker (or a GitHub Classroom / org team)
gh api -X PUT repos/<you>/zk-pay-starter/collaborators/THEIR_LOGIN -f permission=push
```

Tell them: **Fork the repo, clone YOUR fork, then follow `docs/HACKER.md`.**
Their first milestone is a hello proof verified on Stellar testnet — that is
GIVEN and must work on a fresh laptop.

For a public event you can flip visibility later (`gh repo edit --visibility public`).
Until then, collaborators + fork is the path.

## Pre-event checklist

- [ ] `bun run doctor` — testnet RPC up, protocol ≥ 28
- [ ] Friendbot funds 15 keys (or a facilitator bank)
- [ ] `./scripts/install-tools.sh && bun run setup` on two spare laptops
- [ ] Noir M1: `bun run verify:hello --path noir --network testnet` → explorer link
- [ ] Circom M1: `bun run verify:hello --path circom --network testnet`
- [ ] GitHub repo is private; hackers invited; they can fork
- [ ] `solutions` is **not** on GitHub (`gh api repos/<you>/zk-pay-starter/branches` has only `main`)
- [ ] OpenRouter key limit set; `bun run tokens` works
- [ ] `docs/HACKER.md` and `CONTEXT.md` linked in the event brief

## Hello / M1 measurements (this tree, testnet)

`stellar --cost` prints fees, not instruction counts. Use `bun run cost`
(`simulateTransaction` → `resources.instructions`). Testnet cap = 400M.

| Path | Verify-alone CPU | Example `--send yes` tx |
|---|---|---|
| Noir / UltraHonk | 78,658,420 | `5a134eef1d746b6fa37be3c11d6c06cd77661c052b8dc3228a09a6629ba68708` |
| Circom / Groth16 | 27,294,181 | `5414fcdd7cfc6cb91831bc0c0462985353ba0fd403cb0d6c301caa71ca35ff95` |

Hackers deploy **their own** contract IDs. These numbers are only a sanity check
that UltraHonk still fits the 400M cap.
