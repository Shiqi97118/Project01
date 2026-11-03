import {
    _decorator,
    BlockInputEvents,
    Button,
    Color,
    Component,
    Graphics,
    Label,
    Node,
    Tween,
    UIOpacity,
    UITransform,
    Vec3,
    tween,
} from 'cc';
import {
    Card,
    Suit,
    evaluate,
    freshDeck,
    hasLegalPlay,
    rankLabel,
    shuffle,
    sortHand,
} from './cards';
import {
    BLINDS,
    CHARACTER,
    HAND_NAME,
    Joker,
    extraPlays,
    offerJokers,
    preferredBonus,
    scoreHand,
} from './content';

const { ccclass } = _decorator;

type Phase = 'intro' | 'drop' | 'play' | 'joker' | 'done';

const FONT = 'Microsoft YaHei';
const HAND_W = 74;
const HAND_H = 112;
const PLAY_W = 68;
const PLAY_H = 100;

/**
 * Portrait demo: a short eye-contact beat, then the view drops onto the table.
 * 沙狐's preferred-hand bonus is shown on screen and is never added to the clear score.
 */
@ccclass('Boot')
export class Boot extends Component {
    private phase: Phase = 'intro';
    private blindIndex = 0;
    private score = 0;
    private playsLeft = 0;
    private discardsLeft = 0;
    private bonus = 0;
    private deck: Card[] = [];
    private hand: Card[] = [];
    private selected: number[] = [];
    private lastPlay: Card[] = [];
    private jokers: Joker[] = [];
    private offer: Joker[] = [];
    private hitLimit = false;
    private statusText = '';
    private previewText = '';
    private resultTitle = '';
    private resultBody = '';

    private introNode!: Node;
    private tableNode!: Node;
    private overlay!: Node;
    private introOpacity!: UIOpacity;
    private tableOpacity!: UIOpacity;
    private handViews: CardView[] = [];
    private playViews: CardView[] = [];
    private blindLabel!: Label;
    private scoreLabel!: Label;
    private countLabel!: Label;
    private characterLabel!: Label;
    private bonusLabel!: Label;
    private jokerLabel!: Label;
    private statusLabel!: Label;
    private previewLabel!: Label;
    private barGraphics!: Graphics;
    private playButton!: Button;
    private discardButton!: Button;
    private playGraphics!: Graphics;
    private discardGraphics!: Graphics;
    private playLabel!: Label;
    private discardLabel!: Label;
    private overlayTitle!: Label;
    private overlayBody!: Label;
    private offerButtons: OfferButton[] = [];
    private retryNode!: Node;

    onLoad() {
        this.build();
    }

    private build() {
        this.resetState();
        const rootUi = this.node.getComponent(UITransform);
        if (rootUi) rootUi.setContentSize(720, 1280);

        this.introNode = makeNode(this.node, 'Intro', 720, 1280);
        this.introOpacity = this.introNode.addComponent(UIOpacity);
        this.introNode.addComponent(BlockInputEvents);
        this.drawIntro(this.introNode);
        this.introNode.on(Node.EventType.TOUCH_END, () => this.startDrop());

        this.tableNode = makeNode(this.node, 'Table', 720, 1280);
        this.tableOpacity = this.tableNode.addComponent(UIOpacity);
        this.drawTable(this.tableNode);

        this.overlay = makeNode(this.node, 'Overlay', 720, 1280);
        this.overlay.addComponent(BlockInputEvents);
        this.drawOverlay(this.overlay);
        this.overlay.active = false;

        this.placeTableOffscreen();
        this.render();
        this.runIntro();
    }

    private resetState() {
        this.phase = 'intro';
        this.blindIndex = 0;
        this.score = 0;
        this.playsLeft = 0;
        this.discardsLeft = 0;
        this.bonus = 0;
        this.deck = [];
        this.hand = [];
        this.selected = [];
        this.lastPlay = [];
        this.jokers = [];
        this.offer = [];
        this.hitLimit = false;
        this.statusText = '';
        this.previewText = '';
        this.resultTitle = '';
        this.resultBody = '';
        this.handViews = [];
        this.playViews = [];
        this.offerButtons = [];
    }

    private runIntro() {
        this.phase = 'intro';
        this.introNode.active = true;
        this.introNode.setPosition(0, 0, 0);
        this.introNode.setScale(1, 1, 1);
        this.introOpacity.opacity = 255;
        this.scheduleOnce(() => this.startDrop(), 1.15);
    }

    private placeTableOffscreen() {
        this.tableNode.setPosition(0, -1400, 0);
        this.tableOpacity.opacity = 0;
    }

    private startDrop() {
        if (this.phase !== 'intro') return;
        this.phase = 'drop';
        this.unscheduleAllCallbacks();
        this.prepareBlind(0);
        this.render();
        tween(this.introNode)
            .to(0.9, { position: new Vec3(0, 1400, 0) }, { easing: 'quadIn' })
            .start();
        tween(this.introOpacity)
            .to(0.9, { opacity: 0 })
            .start();
        tween(this.tableOpacity)
            .to(0.45, { opacity: 255 })
            .start();
        tween(this.tableNode)
            .to(0.9, { position: new Vec3(0, 0, 0) }, { easing: 'quadOut' })
            .call(() => {
                if (this.phase !== 'drop' || !this.introNode.isValid) return;
                this.phase = 'play';
                this.introNode.active = false;
                this.render();
            })
            .start();
    }

    private prepareBlind(index: number) {
        const blind = BLINDS[index];
        this.blindIndex = index;
        this.score = 0;
        this.playsLeft = blind.plays + extraPlays(this.jokers);
        this.discardsLeft = blind.discards;
        this.deck = shuffle(freshDeck());
        this.hand = [];
        this.selected = [];
        this.lastPlay = [];
        this.hitLimit = false;
        this.drawUp();
        this.hand = sortHand(this.hand);
        this.statusText = `${blind.name}。目标 ${blind.target}。出牌 ${this.playsLeft} 次，弃牌 ${this.discardsLeft} 次。`;
        this.previewText = '选 1 到 5 张，出牌或弃牌';
    }

    private drawUp() {
        while (this.hand.length < 8 && this.deck.length > 0) {
            const next = this.deck.pop();
            if (next) this.hand.push(next);
        }
    }

    onCard(index: number) {
        if (this.phase !== 'play') return;
        const existing = this.selected.indexOf(index);
        if (existing >= 0) {
            this.selected.splice(existing, 1);
            this.hitLimit = false;
        } else if (this.selected.length >= 5) {
            this.hitLimit = true;
        } else {
            this.selected.push(index);
            this.hitLimit = false;
        }
        this.render();
    }

    private onPlay() {
        if (this.phase !== 'play' || this.playsLeft <= 0) return;
        const cards = this.selectedCards();
        const type = evaluate(cards);
        if (!type) return;
        const chips = scoreHand(type, cards, this.jokers);
        const bonus = preferredBonus(type);
        this.score += chips;
        if (bonus > 0) this.bonus += bonus;
        this.playsLeft -= 1;
        this.lastPlay = cards.slice();
        this.removeSelected();
        this.drawUp();
        this.hand = sortHand(this.hand);
        this.statusText = bonus > 0
            ? `${HAND_NAME[type]} +${chips}    ${CHARACTER.name}加成 +${bonus}，不计入过关`
            : `${HAND_NAME[type]} +${chips}`;
        this.afterAction();
    }

    private onDiscard() {
        if (this.phase !== 'play' || this.discardsLeft <= 0 || this.selected.length === 0) return;
        const count = this.selected.length;
        this.removeSelected();
        this.discardsLeft -= 1;
        this.lastPlay = [];
        this.drawUp();
        this.hand = sortHand(this.hand);
        this.statusText = `弃了 ${count} 张`;
        this.afterAction();
    }

    private afterAction() {
        const blind = BLINDS[this.blindIndex];
        if (this.score >= blind.target) {
            this.onCleared();
            return;
        }
        if (this.playsLeft <= 0) {
            this.showResult(false, '出牌次数用完，分数没到目标。');
            return;
        }
        if (this.discardsLeft <= 0 && !hasLegalPlay(this.hand)) {
            this.showResult(false, '没有能打的牌，弃牌次数也用完了。');
            return;
        }
        this.render();
    }

    private onCleared() {
        if (this.blindIndex >= BLINDS.length - 1) {
            this.showResult(true, '');
            return;
        }
        this.phase = 'joker';
        this.offer = offerJokers(this.jokers);
        this.render();
    }

    private onOffer(index: number) {
        if (this.phase !== 'joker') return;
        const joker = this.offer[index];
        if (!joker) return;
        this.jokers = this.jokers.concat([joker]);
        this.phase = 'play';
        this.prepareBlind(this.blindIndex + 1);
        this.statusText = `下一张桌子。${this.statusText}`;
        this.render();
    }

    private showResult(cleared: boolean, reason: string) {
        this.phase = 'done';
        if (cleared) {
            this.resultTitle = '这趟走完了';
            this.resultBody = `三张桌子都到了目标分。\n${CHARACTER.name}的今日加成 +${this.bonus}\n这笔加成不改变过关目标。`;
        } else {
            const blind = BLINDS[this.blindIndex];
            this.resultTitle = '这张桌子没过';
            this.resultBody = `${blind.name}  ${this.score} / ${blind.target}\n${reason}\n今日加成 +${this.bonus}，不计入过关。`;
        }
        this.render();
    }

    private onRetry() {
        if (this.phase !== 'done') return;
        this.stopMotion();
        this.node.removeAllChildren();
        this.build();
    }

    private stopMotion() {
        this.unscheduleAllCallbacks();
        if (this.introNode && this.introNode.isValid) Tween.stopAllByTarget(this.introNode);
        if (this.tableNode && this.tableNode.isValid) Tween.stopAllByTarget(this.tableNode);
        if (this.introOpacity && this.introOpacity.isValid) Tween.stopAllByTarget(this.introOpacity);
        if (this.tableOpacity && this.tableOpacity.isValid) Tween.stopAllByTarget(this.tableOpacity);
    }

    private selectedCards(): Card[] {
        const cards: Card[] = [];
        for (let index = 0; index < this.selected.length; index++) {
            const card = this.hand[this.selected[index]];
            if (card) cards.push(card);
        }
        return cards;
    }

    private removeSelected() {
        const drop = new Set(this.selected);
        this.hand = this.hand.filter((_, index) => !drop.has(index));
        this.selected = [];
        this.hitLimit = false;
    }

    private refreshPreview() {
        if (this.phase !== 'play') {
            this.previewText = '';
            return;
        }
        if (this.hitLimit) {
            this.previewText = '一次最多 5 张';
            return;
        }
        if (this.selected.length === 0) {
            this.previewText = '选 1 到 5 张，出牌或弃牌';
            return;
        }
        const cards = this.selectedCards();
        const type = evaluate(cards);
        if (!type) {
            this.previewText = '要刚好是对子 2 张、三条 3 张，或顺子 / 同花 / 葫芦 5 张';
            return;
        }
        const chips = scoreHand(type, cards, this.jokers);
        const bonus = preferredBonus(type);
        this.previewText = bonus > 0
            ? `${HAND_NAME[type]} 预计 +${chips}，${CHARACTER.name}加成 +${bonus} 只显示不计入`
            : `${HAND_NAME[type]} 预计 +${chips}`;
    }

    private render() {
        const blind = BLINDS[this.blindIndex];
        this.refreshPreview();
        this.blindLabel.string = `${blind.name}  ${this.blindIndex + 1}/${BLINDS.length}`;
        this.scoreLabel.string = `${this.score} / ${blind.target}`;
        this.countLabel.string = `出牌 ${this.playsLeft}    弃牌 ${this.discardsLeft}    牌堆 ${this.deck.length}`;
        this.characterLabel.string = `${CHARACTER.name} · 偏爱顺子、同花`;
        this.bonusLabel.string = `今日加成 +${this.bonus}（不改变过关目标）`;
        this.jokerLabel.string = this.jokers.length === 0
            ? '小丑：还没有'
            : `小丑：${this.jokers.map((joker) => joker.name).join(' · ')}`;
        this.statusLabel.string = this.statusText;
        this.previewLabel.string = this.previewText;
        drawBar(this.barGraphics, blind.target <= 0 ? 0 : this.score / blind.target);

        const handXs = rowXs(this.hand.length, HAND_W, 6);
        for (let index = 0; index < this.handViews.length; index++) {
            const view = this.handViews[index];
            if (index >= this.hand.length) {
                view.slot = -1;
                view.present(null, false, 0, 0);
                continue;
            }
            view.slot = index;
            const selected = this.selected.indexOf(index) >= 0;
            view.present(this.hand[index], selected, handXs[index], selected ? 28 : 0);
        }

        const playXs = rowXs(this.lastPlay.length, PLAY_W, 8);
        for (let index = 0; index < this.playViews.length; index++) {
            const view = this.playViews[index];
            if (index >= this.lastPlay.length) {
                view.present(null, false, 0, 0);
                continue;
            }
            view.present(this.lastPlay[index], false, playXs[index], 0);
        }

        const selectedType = this.phase === 'play' ? evaluate(this.selectedCards()) : null;
        const canPlay = this.phase === 'play' && !!selectedType && this.playsLeft > 0;
        const canDiscard = this.phase === 'play' && this.selected.length > 0 && this.discardsLeft > 0;
        this.playButton.interactable = canPlay;
        this.discardButton.interactable = canDiscard;
        paintButton(this.playGraphics, 220, 76, canPlay);
        paintButton(this.discardGraphics, 220, 76, canDiscard);
        this.playLabel.color = solid(canPlay ? '#241910' : '#6a5c4e');
        this.discardLabel.color = solid(canDiscard ? '#241910' : '#6a5c4e');

        const showOverlay = this.phase === 'joker' || this.phase === 'done';
        this.overlay.active = showOverlay;
        if (this.phase === 'joker') {
            this.overlayTitle.string = `过了${blind.name}`;
            this.overlayBody.string = '选一个小丑。每个只改一条规则。';
        } else if (this.phase === 'done') {
            this.overlayTitle.string = this.resultTitle;
            this.overlayBody.string = this.resultBody;
        }
        for (let index = 0; index < this.offerButtons.length; index++) {
            const offer = this.offer[index];
            const button = this.offerButtons[index];
            button.root.active = this.phase === 'joker' && !!offer;
            if (offer) button.label.string = `${offer.name}\n${offer.detail}`;
        }
        this.retryNode.active = this.phase === 'done';
    }

    private drawIntro(root: Node) {
        const sky = makeNode(root, 'Sky', 720, 1280);
        drawSky(sky.addComponent(Graphics));
        const traveler = makeNode(root, 'Traveler', 240, 420);
        traveler.setPosition(-150, 120, 0);
        drawTraveler(traveler.addComponent(Graphics));
        const travelerName = makeLabel(traveler, '你', 28, solid('#241910'), 120, 40);
        travelerName.node.setPosition(0, 210, 0);
        const fox = makeNode(root, 'Fox', 240, 420);
        fox.setPosition(160, 130, 0);
        drawFox(fox.addComponent(Graphics));
        const foxName = makeLabel(fox, CHARACTER.name, 28, solid('#241910'), 140, 40);
        foxName.node.setPosition(0, 220, 0);
        const caption = makeLabel(root, `${CHARACTER.name}看着你`, 40, solid('#f0ddb8'), 640, 56);
        caption.node.setPosition(0, -430, 0);
        const sub = makeLabel(root, '对视一拍，然后镜头落到桌上', 24, solid('#f0ddb8'), 640, 40);
        sub.node.setPosition(0, -490, 0);
        const skip = makeLabel(root, '点一下跳过', 20, solid('#d8c4a4'), 240, 32);
        skip.node.setPosition(0, -560, 0);
    }

    private drawTable(root: Node) {
        const felt = makeNode(root, 'Felt', 720, 1280);
        drawFelt(felt.addComponent(Graphics));
        const title = makeLabel(root, '废土酒馆', 34, solid('#f0ddb8'), 320, 46);
        title.node.setPosition(0, 588, 0);
        this.blindLabel = makeLabel(root, '', 28, solid('#f0ddb8'), 420, 40);
        this.blindLabel.node.setPosition(0, 542, 0);
        this.scoreLabel = makeLabel(root, '', 42, solid('#e6b34d'), 420, 52);
        this.scoreLabel.node.setPosition(0, 488, 0);
        const bar = makeNode(root, 'Bar', 560, 16);
        bar.setPosition(0, 448, 0);
        this.barGraphics = bar.addComponent(Graphics);
        this.countLabel = makeLabel(root, '', 22, solid('#f0ddb8'), 640, 34);
        this.countLabel.node.setPosition(0, 404, 0);
        this.characterLabel = makeLabel(root, '', 24, solid('#f0ddb8'), 640, 36);
        this.characterLabel.node.setPosition(0, 352, 0);
        this.bonusLabel = makeLabel(root, '', 22, solid('#e6b34d'), 640, 34);
        this.bonusLabel.node.setPosition(0, 314, 0);
        this.jokerLabel = makeLabel(root, '', 22, solid('#f0ddb8'), 640, 34);
        this.jokerLabel.node.setPosition(0, 276, 0);
        this.statusLabel = makeLabel(root, '', 24, solid('#fff8e8'), 660, 64);
        this.statusLabel.node.setPosition(0, 214, 0);
        this.previewLabel = makeLabel(root, '', 20, solid('#d8c4a4'), 660, 56);
        this.previewLabel.node.setPosition(0, 160, 0);

        const playRow = makeNode(root, 'PlayRow', 680, PLAY_H);
        playRow.setPosition(0, 48, 0);
        for (let index = 0; index < 5; index++) {
            this.playViews.push(new CardView(playRow, this, PLAY_W, PLAY_H, false));
        }
        const handRow = makeNode(root, 'HandRow', 700, HAND_H);
        handRow.setPosition(0, -210, 0);
        for (let index = 0; index < 8; index++) {
            this.handViews.push(new CardView(handRow, this, HAND_W, HAND_H, true));
        }

        const play = makeButton(root, '出牌', 220, 76, () => this.onPlay());
        play.root.setPosition(-130, -400, 0);
        this.playButton = play.button;
        this.playGraphics = play.graphics;
        this.playLabel = play.label;
        const discard = makeButton(root, '弃牌', 220, 76, () => this.onDiscard());
        discard.root.setPosition(130, -400, 0);
        this.discardButton = discard.button;
        this.discardGraphics = discard.graphics;
        this.discardLabel = discard.label;
        const hint = makeLabel(root, '对子 2 张 · 三条 3 张 · 顺子 / 同花 / 葫芦 5 张', 20, solid('#d8c4a4'), 660, 56);
        hint.node.setPosition(0, -500, 0);
    }

    private drawOverlay(root: Node) {
        const dim = makeNode(root, 'Dim', 720, 1280);
        const dimGraphics = dim.addComponent(Graphics);
        dimGraphics.fillColor = new Color(20, 14, 10, 210);
        dimGraphics.rect(-360, -640, 720, 1280);
        dimGraphics.fill();
        const panel = makeNode(root, 'Panel', 640, 860);
        drawPanel(panel.addComponent(Graphics));
        this.overlayTitle = makeLabel(panel, '', 36, solid('#241910'), 560, 52);
        this.overlayTitle.node.setPosition(0, 360, 0);
        this.overlayBody = makeLabel(panel, '', 24, solid('#3a2418'), 560, 120);
        this.overlayBody.node.setPosition(0, 270, 0);
        const spots = [120, -20, -160];
        for (let index = 0; index < spots.length; index++) {
            const offerIndex = index;
            const button = makeButton(panel, '', 520, 110, () => this.onOffer(offerIndex));
            button.root.setPosition(0, spots[index], 0);
            button.label.fontSize = 26;
            button.label.lineHeight = 34;
            this.offerButtons.push(button);
        }
        const retry = makeButton(panel, '再来一局', 280, 76, () => this.onRetry());
        retry.root.setPosition(0, -320, 0);
        this.retryNode = retry.root;
    }
}

class CardView {
    readonly root: Node;
    slot = -1;
    private readonly graphics: Graphics;
    private readonly rank: Label;
    private readonly width: number;
    private readonly height: number;

    constructor(parent: Node, boot: Boot, width: number, height: number, interactive: boolean) {
        this.width = width;
        this.height = height;
        this.root = makeNode(parent, 'Card', width, height);
        this.graphics = this.root.addComponent(Graphics);
        this.rank = makeLabel(this.root, '', 22, solid('#241910'), 40, 28);
        this.rank.node.setPosition(-width / 2 + 24, height / 2 - 20, 0);
        if (interactive) {
            this.root.on(Node.EventType.TOUCH_END, () => {
                if (this.slot >= 0) boot.onCard(this.slot);
            });
        }
    }

    present(card: Card | null, selected: boolean, x: number, y: number) {
        if (!card) {
            this.root.active = false;
            return;
        }
        this.root.active = true;
        this.root.setPosition(x, y, 0);
        this.rank.string = rankLabel(card.rank);
        this.rank.color = suitColor(card.suit);
        drawCardFace(this.graphics, this.width, this.height, card, selected);
    }
}

interface OfferButton {
    root: Node;
    label: Label;
    button: Button;
    graphics: Graphics;
}

function makeNode(parent: Node, name: string, width: number, height: number): Node {
    const node = new Node(name);
    node.layer = parent.layer;
    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);
    parent.addChild(node);
    return node;
}

function makeLabel(parent: Node, text: string, size: number, color: Color, width: number, height: number): Label {
    const node = makeNode(parent, 'Label', width, height);
    const label = node.addComponent(Label);
    label.useSystemFont = true;
    label.fontFamily = FONT;
    label.string = text;
    label.fontSize = size;
    label.lineHeight = size + 8;
    label.color = color;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.SHRINK;
    label.enableWrapText = true;
    return label;
}

function makeButton(parent: Node, text: string, width: number, height: number, onClick: () => void): OfferButton {
    const root = makeNode(parent, text || 'Button', width, height);
    const graphics = root.addComponent(Graphics);
    paintButton(graphics, width, height, true);
    const button = root.addComponent(Button);
    button.transition = Button.Transition.SCALE;
    button.zoomScale = 1.04;
    const label = makeLabel(root, text, 30, solid('#241910'), width - 20, height - 12);
    root.on(Button.EventType.CLICK, onClick);
    return { root, label, button, graphics };
}

function paintButton(graphics: Graphics, width: number, height: number, enabled: boolean) {
    graphics.clear();
    graphics.fillColor = solid(enabled ? '#e6b34d' : '#8a7b68');
    graphics.roundRect(-width / 2, -height / 2, width, height, 14);
    graphics.fill();
}

function solid(hex: string): Color {
    const color = new Color();
    color.fromHEX(hex);
    return color;
}

function suitColor(suit: Suit): Color {
    return suit === 'heart' || suit === 'diamond' ? solid('#d85a32') : solid('#241910');
}

function drawCardFace(graphics: Graphics, width: number, height: number, card: Card, selected: boolean) {
    graphics.clear();
    graphics.fillColor = solid(selected ? '#fff8e8' : '#f7edd4');
    graphics.roundRect(-width / 2, -height / 2, width, height, 10);
    graphics.fill();
    graphics.lineWidth = selected ? 5 : 2;
    graphics.strokeColor = solid(selected ? '#e6b34d' : '#241910');
    graphics.roundRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4, 8);
    graphics.stroke();
    drawSuit(graphics, card.suit, 0, -8, 24);
    drawSuit(graphics, card.suit, -width / 2 + 24, height / 2 - 46, 8);
}

function drawSuit(graphics: Graphics, suit: Suit, x: number, y: number, size: number) {
    const color = suitColor(suit);
    const fill = (draw: () => void) => {
        graphics.fillColor = color;
        draw();
        graphics.fill();
    };
    if (suit === 'diamond') {
        fill(() => {
            graphics.moveTo(x, y + size);
            graphics.lineTo(x + size * 0.72, y);
            graphics.lineTo(x, y - size);
            graphics.lineTo(x - size * 0.72, y);
            graphics.close();
        });
        return;
    }
    if (suit === 'heart') {
        fill(() => graphics.circle(x - size * 0.32, y + size * 0.22, size * 0.36));
        fill(() => graphics.circle(x + size * 0.32, y + size * 0.22, size * 0.36));
        fill(() => {
            graphics.moveTo(x - size * 0.64, y + size * 0.16);
            graphics.lineTo(x + size * 0.64, y + size * 0.16);
            graphics.lineTo(x, y - size);
            graphics.close();
        });
        return;
    }
    if (suit === 'club') {
        fill(() => graphics.circle(x, y + size * 0.36, size * 0.32));
        fill(() => graphics.circle(x - size * 0.34, y - size * 0.08, size * 0.32));
        fill(() => graphics.circle(x + size * 0.34, y - size * 0.08, size * 0.32));
        fill(() => graphics.roundRect(x - size * 0.1, y - size, size * 0.2, size * 0.62, 2));
        return;
    }
    fill(() => {
        graphics.moveTo(x, y + size);
        graphics.lineTo(x + size * 0.68, y - size * 0.02);
        graphics.lineTo(x - size * 0.68, y - size * 0.02);
        graphics.close();
    });
    fill(() => graphics.circle(x - size * 0.28, y, size * 0.34));
    fill(() => graphics.circle(x + size * 0.28, y, size * 0.34));
    fill(() => graphics.roundRect(x - size * 0.09, y - size, size * 0.18, size * 0.5, 2));
}

function drawEyes(graphics: Graphics, y: number, look: number) {
    for (const x of [-16, 16]) {
        graphics.fillColor = solid('#f7edd4');
        graphics.circle(x, y, 8);
        graphics.fill();
        graphics.fillColor = solid('#241910');
        graphics.circle(x + look, y, 3.5);
        graphics.fill();
    }
}

function drawTraveler(graphics: Graphics) {
    graphics.clear();
    graphics.fillColor = solid('#c4a574');
    graphics.roundRect(-58, -150, 116, 170, 16);
    graphics.fill();
    graphics.fillColor = solid('#e4b88a');
    graphics.circle(0, 70, 48);
    graphics.fill();
    graphics.fillColor = solid('#3a2418');
    graphics.roundRect(-34, 116, 68, 36, 6);
    graphics.fill();
    graphics.rect(-70, 104, 140, 14);
    graphics.fill();
    drawEyes(graphics, 78, 5);
}

function drawFox(graphics: Graphics) {
    graphics.clear();
    graphics.fillColor = solid('#d85a32');
    graphics.roundRect(-62, -150, 124, 180, 18);
    graphics.fill();
    graphics.fillColor = solid('#e6b34d');
    graphics.moveTo(-42, 104);
    graphics.lineTo(-10, 104);
    graphics.lineTo(-26, 162);
    graphics.close();
    graphics.fill();
    graphics.moveTo(10, 104);
    graphics.lineTo(42, 104);
    graphics.lineTo(26, 162);
    graphics.close();
    graphics.fill();
    graphics.fillColor = solid('#e4b88a');
    graphics.circle(0, 72, 50);
    graphics.fill();
    graphics.fillColor = solid('#d85a32');
    graphics.roundRect(-46, 18, 92, 28, 8);
    graphics.fill();
    graphics.fillColor = solid('#3a2418');
    graphics.circle(0, 46, 10);
    graphics.fill();
    drawEyes(graphics, 84, -5);
}

function drawSky(graphics: Graphics) {
    graphics.clear();
    graphics.fillColor = solid('#e38a4a');
    graphics.rect(-360, 180, 720, 460);
    graphics.fill();
    graphics.fillColor = solid('#c4623a');
    graphics.rect(-360, -80, 720, 260);
    graphics.fill();
    graphics.fillColor = solid('#7a4e34');
    graphics.rect(-360, -640, 720, 560);
    graphics.fill();
    graphics.fillColor = solid('#3a2418');
    graphics.rect(-360, -130, 720, 90);
    graphics.fill();
}

function drawFelt(graphics: Graphics) {
    graphics.clear();
    graphics.fillColor = solid('#2c1c14');
    graphics.rect(-360, -640, 720, 1280);
    graphics.fill();
    graphics.fillColor = solid('#5c3828');
    graphics.roundRect(-340, -600, 680, 1200, 28);
    graphics.fill();
    graphics.fillColor = solid('#3f5c49');
    graphics.roundRect(-316, -576, 632, 1152, 22);
    graphics.fill();
    graphics.strokeColor = solid('#2a4033');
    graphics.lineWidth = 4;
    graphics.roundRect(-292, -552, 584, 1104, 16);
    graphics.stroke();
    graphics.fillColor = solid('#e6b34d');
    graphics.circle(0, 560, 16);
    graphics.fill();
}

function drawPanel(graphics: Graphics) {
    graphics.clear();
    graphics.fillColor = solid('#3a2418');
    graphics.roundRect(-320, -430, 640, 860, 24);
    graphics.fill();
    graphics.fillColor = solid('#f0ddb8');
    graphics.roundRect(-300, -410, 600, 820, 18);
    graphics.fill();
}

function drawBar(graphics: Graphics, ratio: number) {
    const width = 560;
    const height = 16;
    const clamped = Math.max(0, Math.min(1, ratio));
    graphics.clear();
    graphics.fillColor = solid('#2a4033');
    graphics.roundRect(-width / 2, -height / 2, width, height, 8);
    graphics.fill();
    if (clamped <= 0) return;
    graphics.fillColor = solid('#e6b34d');
    graphics.roundRect(-width / 2 + 2, -height / 2 + 2, Math.max(8, (width - 4) * clamped), height - 4, 6);
    graphics.fill();
}

function rowXs(count: number, cardWidth: number, gap: number): number[] {
    if (count <= 0) return [];
    const total = count * cardWidth + (count - 1) * gap;
    const start = -total / 2 + cardWidth / 2;
    const step = cardWidth + gap;
    const positions: number[] = [];
    for (let index = 0; index < count; index++) positions.push(start + index * step);
    return positions;
}
