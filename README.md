# Project01

Cocos Creator 3.8 portrait demo. The table is 9:16 (720×1280). Art is flat wasteland shapes, not finished illustration.

## Open in Cocos Creator

1. Install Cocos Creator 3.8 (3.8.6, or another 3.8 release).
2. In Cocos Dashboard, choose **Open** and select this folder — the one that contains `assets/` and `package.json`.
3. In the Assets panel, open `assets/scenes/Boot.scene`.
4. Press **Play**. If the game view is not portrait, set the preview resolution to **720×1280**.

The first open creates `library/` and `temp/`. Those folders are gitignored.

## What you can play

One run, one character, no save.

1. **沙狐** looks across the table for a beat. Tap to skip the wait. The view then drops onto the top-down table.
2. Three blinds: **锈门**, **沙桌**, **赌桌**. Each has a target score, a limited number of plays, and a limited number of discards.
3. A 52-card deck. You are dealt 8 cards and may play up to 5. Scoring hands are exactly a pair (2), three of a kind (3), straight (5), flush (5), or full house (5). A-2-3-4-5 counts as a straight.
4. Reach the target before plays run out to clear the blind. Miss it and the run fails. **再来一局** starts over.
5. After the first and second blinds, pick 1 of 3 jokers. Six exist: 锈钉, 三钉, 直路, 同色布, 满座, 加一手. Each changes one rule.
6. 沙狐 prefers straights and flushes. That bonus is shown as **今日加成** and is not added to the score that clears a blind.

Not in this demo: ads, shop, currency, leaderboard, guild, extra characters, save, or network.
