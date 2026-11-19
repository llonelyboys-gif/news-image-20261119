# The World in One Picture — 19 November 2026

Sum up Thursday 19 November 2026's world news in one image, for the
[make.fun](https://make.fun/bounty/news-image-20261119) `news-image-20261119` bounty.

## What it is

`main.ts` (Node 22, standard library only) draws a 1024x1024 newspaper-style
infographic with its own bitmap font and PNG encoder — no network, no clock,
no randomness — and writes it to `/output/entry.png`.

Six stories define the day:

1. **The summit** — Trump, Xi and Putin hold their first three-way summit in Shenzhen.
2. **War** — Ukraine strikes the Crimea bridge for the third time in a week.
3. **Middle East** — Iran and the US trade strikes across the Gulf; a tanker is hit in Hormuz.
4. **Justice** — the world court rules on the Rohingya genocide case against Myanmar.
5. **Climate** — COP31 ministers race to unblock a deal in Antalya.
6. **Money & culture** — Anthropic's record market debut, and a Van Gogh selling for $190.4M.

## Run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Two runs write byte-identical files. The output is a 1024x1024 PNG, well under 1 MiB.

## License

MIT
