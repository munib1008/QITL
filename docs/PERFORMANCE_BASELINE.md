# Performance baseline

Measured 2026-11-04 against https://qitl.vercel.app with headless Chromium, no throttling, cold cache, median of 3 runs per page. These numbers describe this machine and network on this date; use them to compare before and after a change on the same setup, not as absolute scores.

| Viewport | Page | TTFB ms | FCP ms | LCP ms | Load ms | CLS | Script KB (encoded) | Requests |
|---|---|---|---|---|---|---|---|---|
| desktop 1440 | `/` | 131 | 1416 | 1416 | 1536 | 0.000 | 355 | 42 |
| desktop 1440 | `/hub/learn` | 119 | 816 | 816 | 952 | 0.000 | 346 | 58 |
| desktop 1440 | `/quran/1` | 127 | 1576 | 1576 | 1602 | 0.000 | 391 | 61 |
| desktop 1440 | `/quran/12` | 116 | 1036 | 1036 | 1256 | 0.000 | 391 | 61 |
| desktop 1440 | `/prophets/yusuf` | 123 | 1368 | 1368 | 1501 | 0.007 | 410 | 72 |
| desktop 1440 | `/drafts/yusuf` | 124 | 1132 | 1132 | 1368 | 0.000 | 355 | 57 |
| desktop 1440 | `/timeline` | 124 | 816 | 1140 | 838 | 0.000 | 353 | 52 |
| desktop 1440 | `/creation` | 123 | 1164 | 1164 | 1242 | 0.003 | 351 | 53 |
| desktop 1440 | `/guidance/grief-and-loss` | 121 | 860 | 860 | 957 | 0.000 | 347 | 54 |
| desktop 1440 | `/verification` | 112 | 932 | 932 | 1030 | 0.000 | 346 | 50 |
| desktop 1440 | `/ar` | 116 | 1048 | 1048 | 1162 | 0.000 | 355 | 43 |
| desktop 1440 | `/ur` | 120 | 1296 | 1296 | 1806 | 0.016 | 355 | 45 |
| phone 390 | `/` | 115 | 1008 | 1008 | 1089 | 0.000 | 356 | 41 |
| phone 390 | `/hub/learn` | 122 | 692 | 692 | 789 | 0.000 | 346 | 49 |
| phone 390 | `/quran/1` | 127 | 1008 | 1008 | 1150 | 0.000 | 391 | 53 |
| phone 390 | `/quran/12` | 121 | 1100 | 1100 | 1185 | 0.000 | 391 | 53 |
| phone 390 | `/prophets/yusuf` | 117 | 1196 | 1196 | 1411 | 0.000 | 410 | 63 |
| phone 390 | `/drafts/yusuf` | 114 | 1268 | 1268 | 1297 | 0.000 | 356 | 50 |
| phone 390 | `/timeline` | 120 | 688 | 1116 | 828 | 0.000 | 353 | 44 |
| phone 390 | `/creation` | 116 | 1556 | 1556 | 1673 | 0.000 | 353 | 45 |
| phone 390 | `/guidance/grief-and-loss` | 114 | 1276 | 1276 | 1263 | 0.000 | 348 | 47 |
| phone 390 | `/verification` | 124 | 1032 | 1032 | 1039 | 0.000 | 347 | 43 |
| phone 390 | `/ar` | 125 | 1240 | 1240 | 1453 | 0.000 | 356 | 42 |
| phone 390 | `/ur` | 121 | 1324 | 1324 | 1947 | 0.000 | 356 | 44 |

Reading it: LCP under about 2500 ms and CLS under 0.1 are the usual "good" thresholds; anything above them is a candidate to investigate, not proof of a problem on a visitor's device.
